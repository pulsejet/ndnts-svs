import { Endpoint, Producer } from "@ndn/endpoint";
import { FwFace } from "@ndn/fw";
import { TT, Component, Data, Interest, Name } from "@ndn/packet";
import { Encoder, NNI } from "@ndn/tlv";
import { Logic } from "./logic";
import * as T from './typings';

export class Socket {
    private m_endpoint: Endpoint;
    private m_syncPrefix: Name;
    private m_dataPrefix: Name;
    private m_id: T.NodeID;
    private m_registeredDataPrefix: Producer;
    private m_ims: { [key: string]: Data; } = {};
    private m_logic: Logic;

    constructor(
        syncPrefix: Name,
        id: T.NodeID,
        private m_face: FwFace,
        m_updateCallback: T.UpdateCallback,
    ) {
        // Bind async functions
        this.onDataInterest = this.onDataInterest.bind(this);

        // Initialize
        this.m_endpoint = new Endpoint({ fw: m_face.fw });
        this.m_syncPrefix = new Name(syncPrefix).append('s');
        this.m_dataPrefix = new Name(syncPrefix).append('d');
        this.m_id = escape(id);

        // Create Logic
        this.m_logic = new Logic(
            this.m_face, this.m_syncPrefix, m_updateCallback, this.m_id);

        // Register data prefix
        this.m_face.addRoute(this.m_dataPrefix);
        this.m_registeredDataPrefix = this.m_endpoint.produce(this.m_dataPrefix, this.onDataInterest);
    }

    public close() {
        this.m_registeredDataPrefix.close();
        this.m_face.removeRoute(this.m_dataPrefix);
    }

    private async onDataInterest(interest: Interest) {
        return this.m_ims[interest.name.toString()] || undefined;
    }

    public publishData(content: Uint8Array, freshness: number, seqNo: T.SeqNo = -1): void {
        const data = new Data();
        data.content = content;
        data.freshnessPeriod = freshness;

        if (seqNo < 0)
            seqNo = this.m_logic.getSeqNo(this.m_id) + 1;

        data.name = new Name(this.m_dataPrefix)
                    .append(this.m_id)
                    .append(this.getNNIComponent(seqNo));

        this.m_ims[data.name.toString()] = data;
        this.m_logic.updateSeqNo(seqNo, this.m_id);
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
