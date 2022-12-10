//helper function
export function correctTime(timestamp) {
    const insert_time_stamp = new Date(timestamp).getTime()
    const current_time_in_millis = new Date().getTime()
    let offset_time = current_time_in_millis - insert_time_stamp
    offset_time = offset_time > 0 ? offset_time : 0

    //const time_value =  new Date(insert_time_stamp + offset_time).toISOString()
    const time_value =  new Date(insert_time_stamp + offset_time)
    return (`${time_value.toLocaleDateString()} ${time_value.toLocaleTimeString()}`)
}


//timer helper function
// Returns a Promise that resolves after "ms" Milliseconds
export const timer = seconds => new Promise(res => setTimeout(res, seconds*1000))


