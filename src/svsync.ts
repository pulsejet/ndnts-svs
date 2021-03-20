import { Name, Data, AltUri } from "@ndn/packet";
import { SVSyncBase } from "./svsync-base";
import * as T from './typings';

export interface SVSyncOptions extends T.SVSOptions {
    dataPrefix: Name;
}

export class SVSync extends SVSyncBase {
    constructor(
        readonly s_opts: SVSyncOptions,
    ) {
        super({
            ... s_opts,
            dataPrefix: new Name(s_opts.dataPrefix).append(...s_opts.syncPrefix.comps),
            id: AltUri.ofName(s_opts.dataPrefix),
        });
    }

    protected getDataName(nid: T.NodeID, seqNo: T.SeqNo) {
      return new Name(nid).append(...this.opts.syncPrefix.comps)
                          .append(this.getNNIComponent(seqNo));
    }

    protected shouldCache(data: Data): boolean {
        return false;
    }
}
