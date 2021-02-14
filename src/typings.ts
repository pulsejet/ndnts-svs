import { Data, Interest } from "@ndn/packet";
import { Endpoint } from "@ndn/endpoint";
import { FwFace } from "@ndn/fw";
import { Name } from "@ndn/packet";
import { VersionVector } from "./version-vector";

export type NodeID = string;
export type SeqNo = number;

export type MissingDataInfo = {
    /** Session name */
    session: NodeID;
    /** The lowest one of missing sequence numbers */
    low: SeqNo;
    /** The highest one of missing sequence numbers  */
    high: SeqNo;
};

/** Callback when new data is discovered */
export type UpdateCallback = (info: MissingDataInfo[]) => void;

export interface DataStore {
    /** Insert a data packet into the store */
    insert: (data: Data) => Promise<void>;
    /** Get a data packet from the store */
    find: (interest: Interest) => Promise<Data | undefined>;
}

/** Options for SVS socket/logic */
export interface SVSOptions {
    /** FwFace to use for sync/data */
    face: FwFace;
    /** Endpoint to use for sync/data */
    endpoint?: Endpoint;
    /** Sync group prefix */
    prefix: Name;
    /** Node ID */
    id: NodeID;
    /** Callback when new data is discovered */
    update: UpdateCallback;
    /** Symmetric key for signing sync interests */
    syncKey?: Uint8Array;
    /** Store for data packets */
    dataStore?: DataStore;
    /** Cache data from all nodes */
    cacheAll?: boolean;
    /** Initial version vector to start with */
    initialVersionVector?: VersionVector;
}
