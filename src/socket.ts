import { Endpoint, Producer } from "@ndn/endpoint";
import { TT, Component, Data, Interest, Name } from "@ndn/packet";
import { Encoder, NNI } from "@ndn/tlv";
import { Logic } from "./logic";
import { MemoryDataStore } from "./store-memory";
import * as T from './typings';

// Export types again
export { DataStore, SVSOptions } from './typings';
export { VersionVector } from './version-vector';

export class Socket {
    private readonly m_endpoint: Endpoint;
    private readonly m_dataPrefix: Name;
    private readonly m_registeredDataPrefix: Producer;
    public readonly m_id: T.NodeID;
    public readonly m_dataStore: T.DataStore;
    public readonly m_logic: Logic;

    constructor(
        private opts: T.SVSOptions,
    ) {
        // Bind async functions
        this.onDataInterest = this.onDataInterest.bind(this);
        this.publishData = this.publishData.bind(this);
        this.fetchData = this.fetchData.bind(this);

        // Initialize
        this.m_id = escape(opts.id);
        this.m_endpoint = opts.endpoint || new Endpoint({ fw: opts.face.fw });
        this.m_dataStore = opts.dataStore || new MemoryDataStore();

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
        return await this.m_dataStore.find(interest);
    }

    public async publishData(
        content: Uint8Array,
        freshness: number,
        nid: T.NodeID = this.m_id,
        seqNo: T.SeqNo = -1,
    ): Promise<void> {
        const data = new Data();
        data.content = content;
        data.freshnessPeriod = freshness;

        if (seqNo < 0)
            seqNo = this.m_logic.getSeqNo(nid) + 1;

        data.name = new Name(this.m_dataPrefix)
                    .append(nid)
                    .append(this.getNNIComponent(seqNo));

        await this.m_dataStore.insert(data);
        this.m_logic.updateSeqNo(seqNo, nid);
    }

    public async fetchData(nid: T.NodeID, seqNo: T.SeqNo) {
        const interestName = new Name(this.m_dataPrefix)
                            .append(nid)
                            .append(this.getNNIComponent(seqNo))
        const interest = new Interest(interestName, Interest.MustBeFresh);

        const data = await this.m_endpoint.consume(interest);

        if (this.opts.cacheAll) {
            this.m_dataStore.insert(data);
        }

        return data;
    }

    private getNNIComponent(num: number) {
        let encoder = new Encoder();
        encoder.encode(NNI(num));
        return new Component(TT.GenericNameComponent, encoder.output);
    }
}
