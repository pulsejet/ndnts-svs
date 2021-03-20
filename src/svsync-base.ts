import { Endpoint, Producer } from "@ndn/endpoint";
import { TT, Component, Data, Interest, Name } from "@ndn/packet";
import { Encoder, NNI } from "@ndn/tlv";
import { SVSyncCore } from "./core";
import { MemoryDataStore } from "./store-memory";
import * as T from './typings';

export interface SVSyncBaseOptions extends T.SVSOptions {
    dataPrefix: Name;
    id: T.NodeID;
}

export abstract class SVSyncBase {
    private readonly m_endpoint: Endpoint;
    private readonly m_registeredDataPrefix: Producer;
    public readonly m_id: T.NodeID;
    public readonly m_dataStore: T.DataStore;
    public readonly m_core: SVSyncCore;

    protected abstract getDataName(nid: T.NodeID, seqNo: T.SeqNo): Name;
    protected abstract shouldCache(data: Data): boolean;

    constructor(
        protected readonly opts: SVSyncBaseOptions,
    ) {
        // Initialize
        this.m_id = escape(opts.id);
        this.m_endpoint = opts.endpoint || new Endpoint({ fw: opts.face.fw });
        this.m_dataStore = opts.dataStore || new MemoryDataStore();

        // Register data prefix
        this.opts.face.addRoute(opts.dataPrefix);
        this.m_registeredDataPrefix = this.m_endpoint.produce(opts.dataPrefix, this.onDataInterest);

        // Terminate if the face closes
        this.opts.face.on("close", this.close);

        // Create core
        this.m_core = new SVSyncCore({
            ...opts,
            syncPrefix: opts.syncPrefix,
            endpoint: this.m_endpoint,
        });
    }

    public close() {
        this.m_registeredDataPrefix.close();
        this.m_core.close();

        if (this.opts.face.running) {
            this.opts.face.removeRoute(this.opts.dataPrefix);
            this.opts.face.removeListener("close", this.close)
        }
    }

    private onDataInterest = async (interest: Interest) => {
        return await this.m_dataStore.find(interest);
    }

    public publishData = async (
        content: Uint8Array,
        freshness: number,
        nid: T.NodeID = this.m_id,
        seqNo: T.SeqNo = -1,
    ): Promise<Data> => {
        const data = new Data();
        data.content = content;
        data.freshnessPeriod = freshness;

        if (seqNo < 0)
            seqNo = this.m_core.getSeqNo(nid) + 1;

        data.name = this.getDataName(nid, seqNo);

        await this.m_dataStore.insert(data);
        this.m_core.updateSeqNo(seqNo, nid);

        return data;
    }

    public fetchData = async (nid: T.NodeID, seqNo: T.SeqNo) => {
        const interestName = this.getDataName(nid, seqNo);
        const data = await this.m_endpoint.consume(interestName);

        if (this.shouldCache(data)) {
            this.m_dataStore.insert(data);
        }

        return data;
    }

    protected getNNIComponent(num: number) {
        let encoder = new Encoder();
        encoder.encode(NNI(num));
        return new Component(TT.GenericNameComponent, encoder.output);
    }
}
