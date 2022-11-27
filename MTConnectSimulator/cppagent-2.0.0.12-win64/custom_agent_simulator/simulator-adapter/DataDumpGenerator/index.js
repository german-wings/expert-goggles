
const values = [
    { value: 'program', expected_value_list: ['PROGRAM_A', 'PROGRAM B'] },
    { value: 'mode', expected_value_list: ['AUTOMATIC', 'MANUAL','MANUAL_DATA_INPUT','FEED_HOLD'] },
    { value: 'rstat', expected_value_list: ['ACTIVE', 'STOPPED'] },
    { value: 'sspeed', expected_value_list: [1.43, 545.54, 76.342, 32, 645, 43.4, 546.76] }
]

const fs = require('fs')


function* log_generator() {

    let start_time = new Date().getTime()

    while (true) {
        let random_iterations = Math.floor(Math.random() * 10) + 1
        let shdr_string = `${new Date(start_time++).toISOString()}`
        for (let counter = 0; counter < random_iterations; counter++) {
            let random_event = Math.floor(Math.random() * values.length)
            let key = values[random_event].value
            let pair = values[random_event].expected_value_list[Math.floor(Math.random() * values[random_event].expected_value_list.length)]
            shdr_string += `|${key}|${pair}`
        }
        yield shdr_string+'\n'
    }
}


const max_count = 100
for(let counter = 0 ; counter < max_count ; counter+=1){
    console.log(`Writing ${counter} of ${max_count}`)
    let value = log_generator().next().value
    fs.writeFile('haas_dump.txt',value , {flag : 'a+' , encoding : 'utf-8'} , error=>{console.log(error)})
}