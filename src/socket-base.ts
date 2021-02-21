import { Endpoint, Producer } from "@ndn/endpoint";
import { TT, Component, Data, Interest, Name } from "@ndn/packet";
import { Encoder, NNI } from "@ndn/tlv";
import { Logic } from "./logic";
import { MemoryDataStore } from "./store-memory";
import * as T from './typings';

export interface SocketBaseOptions extends T.SVSOptions {
    dataPrefix: Name;
    id: T.NodeID;
}

export abstract class SocketBase {
    private readonly m_endpoint: Endpoint;
    private readonly m_registeredDataPrefix: Producer;
    public readonly m_id: T.NodeID;
    public readonly m_dataStore: T.DataStore;
    public readonly m_logic: Logic;

    abstract getDataName(nid: T.NodeID, seqNo: T.SeqNo): Name;

    constructor(
        protected readonly opts: SocketBaseOptions,
    ) {
        // Bind async functions
        this.onDataInterest = this.onDataInterest.bind(this);
        this.publishData = this.publishData.bind(this);
        this.fetchData = this.fetchData.bind(this);

        // Initialize
        this.m_id = escape(opts.id);
        this.m_endpoint = opts.endpoint || new Endpoint({ fw: opts.face.fw });
        this.m_dataStore = opts.dataStore || new MemoryDataStore();

        // Register data prefix
        this.opts.face.addRoute(opts.dataPrefix);
        this.m_registeredDataPrefix = this.m_endpoint.produce(opts.dataPrefix, this.onDataInterest);

        // Terminate if the face closes
        this.opts.face.on("close", this.close);

        // Create Logic
        this.m_logic = new Logic({
            ...opts,
            syncPrefix: opts.syncPrefix,
            endpoint: this.m_endpoint,
        });
    }

    public close() {
        this.m_registeredDataPrefix.close();
        this.m_logic.close();

        if (this.opts.face.running) {
            this.opts.face.removeRoute(this.opts.dataPrefix);
            this.opts.face.removeListener("close", this.close)
        }
    }

    private async onDataInterest(interest: Interest) {
        return await this.m_dataStore.find(interest);
    }

    public async publishData(
        content: Uint8Array,
        freshness: number,
        nid: T.NodeID = this.m_id,
        seqNo: T.SeqNo = -1,
    ): Promise<Data> {
        const data = new Data();
        data.content = content;
        data.freshnessPeriod = freshness;

        if (seqNo < 0)
            seqNo = this.m_logic.getSeqNo(nid) + 1;

        data.name = this.getDataName(nid, seqNo);

        await this.m_dataStore.insert(data);
        this.m_logic.updateSeqNo(seqNo, nid);

        return data;
    }

    public async fetchData(nid: T.NodeID, seqNo: T.SeqNo) {
        const interestName = this.getDataName(nid, seqNo);
        const data = await this.m_endpoint.consume(interestName);

        // TODO: FUNC
        //if (this.opts.cacheAll) {
            //this.m_dataStore.insert(data);
        //}

        return data;
    }

    protected getNNIComponent(num: number) {
        let encoder = new Encoder();
        encoder.encode(NNI(num));
        return new Component(TT.GenericNameComponent, encoder.output);
    }
}
