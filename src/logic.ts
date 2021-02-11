import { Endpoint, Producer } from "@ndn/endpoint"
import { Data, Interest } from "@ndn/packet";
import { VersionVector } from "./version-vector";
import * as T from './typings';

export class Logic {
    private m_endpoint: Endpoint;
    private m_id: T.NodeID;
    private m_vv = new VersionVector();
    private m_syncRegisteredPrefix: Producer;
    private m_retxEvent: any = 0;
    private m_nextSyncInterest: number = 0;

    constructor (
        private opts: T.SVSOptions,
    ) {
        // Bind async functions
        this.onSyncInterest = this.onSyncInterest.bind(this);
        this.sendSyncInterest = this.sendSyncInterest.bind(this);

        // Initialize
        this.m_id = escape(opts.id);
        this.m_vv.set(this.m_id, 0);
        this.m_endpoint = opts.endpoint || new Endpoint({ fw: opts.face.fw });

        // Register sync prefix
        this.opts.face.addRoute(opts.prefix);
        this.m_syncRegisteredPrefix = this.m_endpoint.produce(opts.prefix, this.onSyncInterest);

        // Start periodically send sync interest
        this.retxSyncInterest();

        // Terminate if the face closes
        this.opts.face.on("close", () => this.close());
    }

    public close() {
        this.m_syncRegisteredPrefix.close();
        clearTimeout(this.m_retxEvent);

        if (this.opts.face.running) {
            this.opts.face.removeRoute(this.opts.prefix);
        }
    }

    private async onSyncInterest(interest: Interest) {
        const encodedVV = interest.name.get(-2)?.tlv as Uint8Array;
        if (!encodedVV) return;

        const vvOther = VersionVector.from(encodedVV) as VersionVector;
        if (!vvOther) return;

        const mergeRes = this.mergeStateVector(vvOther);

        // Suppress if nothing new
        if (!mergeRes.myVectorNew && !mergeRes.otherVectorNew) {
            this.retxSyncInterest(false);
        }

        // Send sync interest if vectors different
        else if (!this.opts.enableAck || mergeRes.otherVectorNew) {
            const delay = 50 * this.jitter(10);

            if (performance.now() + delay < this.m_nextSyncInterest) {
                this.retxSyncInterest(false, delay);
            }
        }

        // Return reply if my vector is new (and ACK enabled)
        if (this.opts.enableAck && mergeRes.myVectorNew) {
            const data = new Data(interest.name);
            data.content = this.m_vv.encodeToComponent().tlv;
            data.freshnessPeriod = 4000;
            return data;
        }

        return undefined;
    }

    private retxSyncInterest(send = true, delay = -1) {
        // Send sync interest
        if (send) {
            this.sendSyncInterest();
        }

        // Heartbeat delay if not set
        if (delay < 0) {
            delay = 30000 * this.jitter(10);
        }

        // Store the scheduled time
        this.m_nextSyncInterest = performance.now() + delay;

        // Set new event
        clearTimeout(this.m_retxEvent);
        this.m_retxEvent = setTimeout(this.retxSyncInterest.bind(this), delay);
    }

    private async sendSyncInterest() {
        const syncName = this.opts.prefix.append(this.m_vv.encodeToComponent())
                                         .append('<signature>');

        const interest = new Interest(syncName);
        interest.canBePrefix = true;
        interest.mustBeFresh = true;
        interest.lifetime = 1000;

        let data: Data;
        try {
            data = await this.m_endpoint.consume(interest);
        } catch (err) {
            return;
        }

        // Try decoding the received version vector
        const newVV = VersionVector.from(data.content) as VersionVector;
        if (newVV) this.mergeStateVector(newVV);
    }

    private mergeStateVector(vvOther: VersionVector) {
        let myVectorNew = false;
        let otherVectorNew = false;

        const missingData: T.MissingDataInfo[] = [];

        // Check if other vector has newer state
        for (const nid of vvOther.getNodes()) {
            const seqSelf = this.m_vv.get(nid);
            const seqOther = vvOther.get(nid);

            if (seqSelf < seqOther) {
                otherVectorNew = true;
                missingData.push({ session: nid, low: seqSelf + 1, high: seqOther });
                this.m_vv.set(nid, seqOther);
            }
        }

        // Callback if missing data
        if (missingData.length > 0) this.opts.update(missingData);

        // Check if current version vector has new state
        for (const nid of this.m_vv.getNodes()) {
            const seq = this.m_vv.get(nid);
            const seqOther = vvOther.get(nid);

            if (seqOther < seq) {
                myVectorNew = true;
                break;
            }
        }

        return { myVectorNew, otherVectorNew };
    }

    public updateSeqNo(seq: T.SeqNo, nid: T.NodeID = this.m_id): void {
        const prev = this.m_vv.get(nid);
        this.m_vv.set(nid, seq);

        if (seq > prev)
            this.sendSyncInterest();
    }

    public getSeqNo(nid: T.NodeID = this.m_id) {
        return this.m_vv.get(nid);
    }

    private jitter(percent: number) {
        return (1 - percent / 100) + 2 * (percent / 100) * Math.random();
    }
}
