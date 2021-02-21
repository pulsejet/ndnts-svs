import { Name, AltUri } from "@ndn/packet";
import { SocketBase } from "./socket-base";
import * as T from './typings';

export interface SocketOptions extends T.SVSOptions {
    dataPrefix: Name;
}

export class Socket extends SocketBase {
    constructor(
        s_opts: SocketOptions,
    ) {
        super({
            ... s_opts,
            dataPrefix: new Name(s_opts.dataPrefix).append(...s_opts.syncPrefix.comps),
            id: AltUri.ofName(s_opts.dataPrefix),
        });
    }

    getDataName(nid: T.NodeID, seqNo: T.SeqNo) {
      return new Name(nid).append(...this.opts.syncPrefix.comps)
                          .append(this.getNNIComponent(seqNo));
    }
}
