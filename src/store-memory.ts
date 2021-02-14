import { Data, Interest } from "@ndn/packet";
import * as T from './typings';

export class MemoryDataStore implements T.DataStore {
    private m_ims: { [key: string]: Data; } = {};

    public insert(data: Data): Promise<void> {
        return new Promise((resolve) => {
            this.m_ims[data.name.toString()] = data;
            resolve();
        })
    }

    public find(interest: Interest): Promise<Data | undefined> {
        return new Promise((resolve) => {
            resolve(this.m_ims[interest.name.toString()]);
        })
    }
}
