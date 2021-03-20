import { Endpoint, Producer } from "@ndn/endpoint"
import { Interest, Verifier, Signer, Name } from "@ndn/packet";
import { createSigner, createVerifier, HMAC } from "@ndn/keychain";
import { VersionVector } from "./version-vector";
import * as T from './typings';

export interface CoreOptions extends T.SVSOptions {
    dataPrefix: Name;
    id: T.NodeID;
}

export class SVSyncCore {
    private readonly m_endpoint: Endpoint;
    public readonly m_id: T.NodeID;
    public readonly m_vv: VersionVector;
    private readonly m_syncRegisteredPrefix: Producer;
    private m_retxEvent: any = 0;
    private m_nextSyncInterest: number = 0;

    private m_syncKey?: Uint8Array;
    private m_interestSigner?: Signer;
    private m_interestVerifier?: Verifier;
    private m_recordedVv?: VersionVector;

    constructor (
        private readonly opts: CoreOptions,
    ) {
        // Initialize
        this.m_id = escape(opts.id);
        this.m_endpoint = opts.endpoint || new Endpoint({ fw: opts.face.fw });
        this.m_vv = opts.initialVersionVector || new VersionVector();

        // Register sync prefix
        this.opts.face.addRoute(opts.syncPrefix);
        this.m_syncRegisteredPrefix = this.m_endpoint.produce(opts.syncPrefix, this.onSyncInterest);

        // Terminate if the face closes
        this.opts.face.on("close", this.close);

        // Do async initialization
        this.initialize();
    }

    public initialize = async () => {
        // Setup interest security
        if (this.opts.security?.interestSignatureType == "HMAC") {
            const sKey = await HMAC.cryptoGenerate({
                importRaw: this.opts.security.hmacKey ?? new Uint8Array(),
            }, true);

            this.m_interestSigner = createSigner(HMAC, sKey);
            this.m_interestVerifier = createVerifier(HMAC, sKey);
        }

        // Start periodically send sync interest
        this.retxSyncInterest();
    }

    public close() {
        this.m_syncRegisteredPrefix.close();
        clearTimeout(this.m_retxEvent);

        if (this.opts.face.running) {
            this.opts.face.removeRoute(this.opts.syncPrefix);
            this.opts.face.removeListener("close", this.close);
        }
    }

    private onSyncInterest = async (interest: Interest) => {
        // Verify incoming interest
        try {
            await this.m_interestVerifier?.verify(interest);
        } catch {
            return;
        }

        // Get encoded version vector
        const encodedVV = interest.name.get(-2)?.tlv as Uint8Array;
        if (!encodedVV) return;

        const vvOther = VersionVector.from(encodedVV) as VersionVector;
        if (!vvOther) return;

        const mergeRes = this.mergeStateVector(vvOther);

        if (this.recordVector(vvOther)) return undefined

        // Suppress if nothing new
        if (!mergeRes.myVectorNew) {
            this.retxSyncInterest(false);
        }

        // Send sync interest if vectors different
        else {
            this.enterSuppressionState(vvOther);

            const delay = 50 * this.jitter(10);

            if (performance.now() + delay < this.m_nextSyncInterest) {
                this.retxSyncInterest(false, delay);
            }
        }

        return undefined;
    }

    private retxSyncInterest(send = true, delay = -1) {
        // Send sync interest
        if (send) {
            if (!this.m_recordedVv || this.mergeStateVector(this.m_recordedVv).myVectorNew) {
                this.sendSyncInterest();
            }
            this.m_recordedVv = undefined;
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

    private sendSyncInterest = async () => {
        const syncName = this.opts.syncPrefix.append(this.m_vv.encodeToComponent());

        const interest = new Interest(syncName);
        interest.canBePrefix = true;
        interest.mustBeFresh = true;
        interest.lifetime = 1000;

        await this.m_interestSigner?.sign(interest);

        try {
            await this.m_endpoint.consume(interest);
        } catch {}
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

    private recordVector(vvOther: VersionVector): boolean {
        if (!this.m_recordedVv) return false;

        for (const nidOther of vvOther.getNodes()) {
          const seqOther = vvOther.get(nidOther);
          const seqCurrent = this.m_recordedVv.get(nidOther);

          if (seqCurrent < seqOther) {
            this.m_recordedVv.set(nidOther, seqOther);
          }
        }

        return true;
    }

    private enterSuppressionState(vvOther: VersionVector): void {
        this.m_recordedVv ||= vvOther;
    }

    public getSyncKey() {
        return this.m_syncKey;
    }

    public updateSeqNo(seq: T.SeqNo, nid: T.NodeID = this.m_id): void {
        const prev = this.m_vv.get(nid);
        this.m_vv.set(nid, seq);

        if (seq > prev)
            this.retxSyncInterest();
    }

    public getSeqNo(nid: T.NodeID = this.m_id) {
        return this.m_vv.get(nid);
    }

    private jitter(percent: number) {
        return (1 - percent / 100) + 2 * (percent / 100) * Math.random();
    }
}
