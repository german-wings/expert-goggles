//helper function
function correctTime(timestamp) {
    const insert_time_stamp = new Date(timestamp).getTime()
    const current_time_in_millis = new Date().getTime()
    let offset_time = current_time_in_millis - insert_time_stamp
    offset_time = offset_time > 0 ? offset_time : 0

    return new Date(insert_time_stamp + offset_time).toISOString()
}
