import { correctTime } from "../Helpers/Time.js"

export class HaasDevice {

    constructor(commonName, url) {

        //initialize defaults
        this.commonName = commonName
        this.endpoint = url

        //just reset the state:
        //create variables bound to the class instance
        this.resetState()
    }

    resetState() {
        this.nextSequence = undefined
        this.nextRequestState = 'probe'
        this.lastSequence = undefined
        this.processedSequences = []
        this.instanceID = undefined
        this.state = {
            COMMONNAME: this.commonName,
            AGENT_BROKER_INSTANCEID: undefined,
            BROKER_CLOUD_INSTANCEID: new Date().getTime().toString(),
            TRIGGERCODE: undefined,
            SERIALNUMBER: undefined,
            STATE_CHANGE_TIME: undefined,
            MODE: undefined,
            PROGRAM: undefined,
            RUNSTATUS: undefined
        }
    }

    updateProcessedSequences(list_of_sequences) {

    }

    updateState(state) {
        //console.log(`${state.getAttribute('name')} - ${state.getAttribute('sequence')} - ${state.textContent.toString()}`.substring(0, 50))
        switch (state.getAttribute('name')) {

            case 'ThisCycle':
                if (this.state.MODE === "AUTOMATIC") {
                    if (this.state.RUNSTATUS === "STOPPED" && (this.state.TRIGGERCODE === "M00" || this.state.TRIGGERCODE === "M01" || this.state.TRIGGERCODE === "M30")) {
                        this.state.RUNSTATUS = "ACTIVE"
                        this.state.STATE_CHANGE_TIME = correctTime(state.getAttribute('timestamp'))
                        this.state.TRIGGERCODE = "CYC_EXEC_TIME_CHANGE"
                    }
                }
                break

            case 'DHMT_Codes':
                //get DHMT Code and check for M Code if its M30
                //if it is then we must check this.state.RUNSTATUS if its stopped okay if its active and DHMT has any
                //of the conditions please change this.state.RUNSTATUS to STOPPED
                this.ACTIVEMCODE = state.textContent.split(',')[2]
                switch (this.ACTIVEMCODE) {
                    case '00':
                        if (this.state.MODE === "AUTOMATIC") {
                            if (this.state.RUNSTATUS === "ACTIVE") {
                                this.state.RUNSTATUS = "STOPPED"
                                this.state.STATE_CHANGE_TIME = correctTime(state.getAttribute('timestamp'))
                                this.state.TRIGGERCODE = "M00"
                            }
                        }
                        break
                    case '01':
                        if (this.state.MODE === "AUTOMATIC") {
                            if (this.state.RUNSTATUS === "ACTIVE") {
                                this.state.RUNSTATUS = "STOPPED"
                                this.state.STATE_CHANGE_TIME = correctTime(state.getAttribute('timestamp'))
                                this.state.TRIGGERCODE = "M01"
                            }
                        }
                        break
                    case '30':
                        //if M30 is reached , we must check if we are in automatic mode or Manual Data Input Mode
                        if (this.state.MODE === "AUTOMATIC") {
                            //now we must check if the state is set to ACTIVE 
                            // if it is then we must set it STOPPED
                            if (this.state.RUNSTATUS === "ACTIVE") {
                                this.state.RUNSTATUS = "STOPPED"
                                this.state.STATE_CHANGE_TIME = correctTime(state.getAttribute('timestamp'))
                                this.state.TRIGGERCODE = "M30"
                            }
                        }
                        break
                }
                break
            case 'RunStatus':
                //guard against UNAVAILABLE entry
                //we must check if the same state was caught before RunStatus specifically by M30
                //if it was then we dont need to make any change to the state if was not then 
                //we must make a change
                const currentState = state.textContent
                if (currentState === this.state.RUNSTATUS && this.state.TRIGGERCODE === "M30") {
                    break
                }
                this.state.RUNSTATUS = state.textContent === "UNAVAILABLE" ? "STOPPED" : state.textContent
                this.state.STATE_CHANGE_TIME = correctTime(state.getAttribute('timestamp'))
                this.state.TRIGGERCODE = "RUNSTATUS"
                break
            case 'Program':
                this.state.TRIGGERCODE = "PROGRAM"
                this.state.PROGRAM = state.textContent
                this.state.STATE_CHANGE_TIME = correctTime(state.getAttribute('timestamp'))
                break
            case 'Mode':
                this.state.TRIGGERCODE = "MODE"
                this.state.MODE = state.textContent
                this.state.STATE_CHANGE_TIME = correctTime(state.getAttribute('timestamp'))
                break
        }
    }

    getState() {
        //capture other variables and prep up the state object for delivery
        this.state.SERIALNUMBER = this.serialNumber
        this.state.AGENT_BROKER_INSTANCEID = this.instanceID
        return this.state
    }

}

