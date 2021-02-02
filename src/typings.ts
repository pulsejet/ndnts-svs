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
