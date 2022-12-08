// TODO: move to interfaces file when ready
interface trigger {
    id: string; // identifier for trigger
    affectedDeviceId: string; // device related to this trigger
    sourceDeviceId?: string; // trigger based on state of different device
    sourceDeviceState?: string; // required state of source device
    absoluteStartTime?: number; // time trigger start
    relativeStart?: string; // special string -- sunrise, sunset?
    interval?: number; // used to calculate the total trigger run time
    minTemp?: number; // min temperature for trigger
    maxTemp?: number; // max temp for trigger
    action: string; // action to be performed
    chainDeviceId?: string; // next trigger to perform when this is complete
}

export class triggerService {
    db: any; // todo replace with mongo instance

    constructor() {
        // create connection to mongo, store to this
    }

    // store new trigger to db
    createTrigger() {

    }

    getTriggersByTime() {

    }

    getTriggersByTemperature() {

    }

    getTriggersBySourceDevice() {
        
    }
}