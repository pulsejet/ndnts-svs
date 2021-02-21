import { Name } from "@ndn/packet";
import { SocketBase } from "./socket-base";
import * as T from './typings';

export interface SocketSharedOptions extends T.SVSOptions {
    dataPrefix: Name;
    id: T.NodeID;
}

export class SocketShared extends SocketBase {
    constructor(
        s_opts: SocketSharedOptions,
    ) {
        super(s_opts);
    }

    getDataName(nid: T.NodeID, seqNo: T.SeqNo) {
      return new Name(this.opts.dataPrefix).append(nid)
                                           .append(this.getNNIComponent(seqNo));
    }
}
