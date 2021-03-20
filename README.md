# NDNts-SVS

[State Vector Sync (SVS)](https://named-data.github.io/StateVectorSync/) library for the browser with NDNts.

## Usage

Note: the library uses the nightly package of NDNts

```sh
npm install ndnts-svs
```

To create a new SVS instance

```typescript
import { SVSync } from 'ndnts-svs';
import { Name } from '@ndn/packet';
import { createSigner, createVerifier, HMAC } from "@ndn/keychain";

const prefix = new Name('/ndn/svs');
const nodeId = 'alice';
const secret = 'confidential';

let sync: SVSync;

// Missing data callback
const updateCallback = (missingData) => {
    // For each node with missing data
    for (const m of missingData) {
        // Fetch all new data
        for (let i = m.low; i <= m.high; i++) {
            sync.fetchData(m.session, i).then((data) => {
                const msg = new TextDecoder().decode(data.content);
                console.log(`${m.session} => ${msg}`);
            }).catch((err) => {
                console.warn(`Could not get data nid=${m.session} => ${i}`);
            });
        }
    }
};

const symKey = await HMAC.cryptoGenerate({
    importRaw: new TextEncoder().encode(secret),
}, true);

// Start SVS instance
sync = new SVSync({
    face: face,
    prefix: prefix,
    id: nodeId,
    update: updateCallback,
    security: {
        syncInterestSigner: createSigner(HMAC, symKey),
        syncInterestVerifier: createVerifier(HMAC, symKey),
    },
});
```

## License

ndnts-svs is an open source project licensed under the LGPL version 2.1.
See [`COPYING.md`](COPYING.md) for more information.
