import { Encoder, Decoder, NNI } from "@ndn/tlv";
import { Component } from "@ndn/packet";
import * as T from "./typings";

const TTVersionVector = 201;
const TTVersionVectorKey = 202;
const TTVersionVectorValue = 203;

export class VersionVector {
    private m_map: { [key: string]: T.SeqNo; } = {};

    /** Set value of node */
    public set(nid: T.NodeID, seqNo: T.SeqNo) {
        this.m_map[nid] = seqNo;
        return seqNo
    }

    /** Get value of node */
    public get(nid: T.NodeID) {
        return this.m_map[nid] || 0;
    }

    /** Get encoder with inner TLV list */
    private encoder(): Encoder {
        let enc = new Encoder();

        for (const key of this.getNodes().reverse()) {
            enc.prependTlv(TTVersionVectorValue, NNI(this.m_map[key]));
            enc.prependTlv(TTVersionVectorKey, new TextEncoder().encode(key));
        }

        return enc;
    }

    /** Encode to name component */
    public encodeToComponent(): Component {
        return new Component(TTVersionVector, this.encoder().output);
    }

    /** Construct VersionVector from buffer */
    public static from(buf: Uint8Array): VersionVector | undefined {
        let decoder = new Decoder(buf);
        const tlv = decoder.read();
        if (tlv.type !== TTVersionVector) return undefined;

        decoder = new Decoder(tlv.value);

        const vv = new VersionVector();

        while (!decoder.eof) {
            // Decode version-vector-key
            let tlv = decoder.read();
            if (tlv.type !== TTVersionVectorKey) return undefined;
            const nid = new TextDecoder().decode(tlv.value);

            // Decode version-vector-value
            tlv = decoder.read();
            if (tlv.type !== TTVersionVectorValue) return undefined;
            const seqNo = NNI.decode(tlv.value);

            // Add value
            vv.set(nid, seqNo);
        }

        return vv;
    }

    /** Get a list of nodes in the vector */
    public getNodes(): T.NodeID[] {
        return Object.keys(this.m_map).sort();
    }

    /** Get a human readable representation */
    public toStr(): string {
        let str = '';
        for (const key of this.getNodes()) {
            str += key + '_' + this.m_map[key] + '_';
        }
        return str;
    }
}