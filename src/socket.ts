import { Endpoint, Producer } from "@ndn/endpoint";
import { TT, Component, Data, Interest, Name } from "@ndn/packet";
import { Encoder, NNI } from "@ndn/tlv";
import { Logic } from "./logic";
import * as T from './typings';

export class Socket {
    private m_endpoint: Endpoint;
    private m_id: T.NodeID;
    private m_dataPrefix: Name;
    private m_registeredDataPrefix: Producer;
    private m_ims: { [key: string]: Data; } = {};
    private m_logic: Logic;

    constructor(
        private opts: T.SVSOptions,
    ) {
        // Bind async functions
        this.onDataInterest = this.onDataInterest.bind(this);

        // Initialize
        this.m_id = escape(opts.id);
        this.m_endpoint = opts.endpoint || new Endpoint({ fw: opts.face.fw });

        const syncPrefix = new Name(opts.prefix).append('s');
        this.m_dataPrefix = new Name(opts.prefix).append('d');

        // Create Logic
        this.m_logic = new Logic({
            ...opts,
            prefix: syncPrefix,
            endpoint: this.m_endpoint,
        });

        // Register data prefix
        this.opts.face.addRoute(this.m_dataPrefix);
        this.m_registeredDataPrefix = this.m_endpoint.produce(this.m_dataPrefix, this.onDataInterest);

        // Terminate if the face closes
        this.opts.face.on("close", () => this.close());
    }

    public close() {
        this.m_registeredDataPrefix.close();
        this.m_logic.close();

        if (this.opts.face.running) {
            this.opts.face.removeRoute(this.m_dataPrefix);
        }
    }

    private async onDataInterest(interest: Interest) {
        return this.m_ims[interest.name.toString()] || undefined;
    }

    public publishData(
        content: Uint8Array,
        freshness: number,
        nid: T.NodeID = this.m_id,
        seqNo: T.SeqNo = -1,
    ): void {
        const data = new Data();
        data.content = content;
        data.freshnessPeriod = freshness;

        if (seqNo < 0)
            seqNo = this.m_logic.getSeqNo(nid) + 1;

        data.name = new Name(this.m_dataPrefix)
                    .append(nid)
                    .append(this.getNNIComponent(seqNo));

        this.m_ims[data.name.toString()] = data;
        this.m_logic.updateSeqNo(seqNo, nid);
    }

    public fetchData(nid: T.NodeID, seqNo: T.SeqNo) {
        const interestName = new Name(this.m_dataPrefix)
                            .append(nid)
                            .append(this.getNNIComponent(seqNo))
        const interest = new Interest(interestName, Interest.MustBeFresh);
        return this.m_endpoint.consume(interest);
    }

    private getNNIComponent(num: number) {
        let encoder = new Encoder();
        encoder.encode(NNI(num));
        return new Component(TT.GenericNameComponent, encoder.output);
    }

    public getLogic() {
        return this.m_logic;
    }
}
