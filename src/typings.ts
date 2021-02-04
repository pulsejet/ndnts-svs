import { Endpoint } from "@ndn/endpoint";
import { FwFace } from "@ndn/fw";
import { Name } from "@ndn/packet";

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
    /** Enable sync ACK */
    enableAck?: boolean;
}
