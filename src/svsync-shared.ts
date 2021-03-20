import { Name, Data } from "@ndn/packet";
import { SVSyncBase } from "./svsync-base";
import * as T from './typings';

export interface SVSyncSharedOptions extends T.SVSOptions {
    dataPrefix: Name;
    id: T.NodeID;
    cacheAll?: boolean;
}

export class SVSyncShared extends SVSyncBase {
    constructor(
        private readonly s_opts: SVSyncSharedOptions,
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
