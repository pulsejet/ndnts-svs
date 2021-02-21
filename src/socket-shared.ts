import { Name, Data } from "@ndn/packet";
import { SocketBase } from "./socket-base";
import * as T from './typings';

export interface SocketSharedOptions extends T.SVSOptions {
    dataPrefix: Name;
    id: T.NodeID;
    cacheAll?: boolean;
}

export class SocketShared extends SocketBase {
    constructor(
        private readonly s_opts: SocketSharedOptions,
    ) {
        super(s_opts);
    }

    protected getDataName(nid: T.NodeID, seqNo: T.SeqNo) {
      return new Name(this.opts.dataPrefix).append(nid)
                                           .append(this.getNNIComponent(seqNo));
    }

    protected shouldCache(data: Data): boolean {
        return this.s_opts.cacheAll || false;
    }
}
