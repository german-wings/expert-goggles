//purpose of the program

/*

This program creates a dump file in SHDR Format , the format is as follows to be written
TIMESTAMP|KEY|VALUE

the Below file will help generate a SHDR Format file which will then be fed to a adapter Simulation file , 
this adapter can the connect to a agent which will accept SHDR and parse the format in to MTConnect Protocol

*/



const random_range_generator = (min , max)=>{
    let iterations = Math.floor(Math.random()*max)+min
    let value = []
    for(let counter=0 ; counter<iterations ; counter++){
        value.push(Math.floor(Math.random()*max)+min)
    }
    return value
}



const values = [
    { value: 'ncprog', expected_value_list: ['PROGRAM_A', 'PROGRAM_B'] },
    { value: 'mode', expected_value_list: ['AUTOMATIC', 'MANUAL','MANUAL_DATA_INPUT','FEED_HOLD'] },
    { value: 'rstat', expected_value_list: ['ACTIVE', 'STOPPED'] },
    { value: 'sspeed', expected_value_list: [...random_range_generator(0,9999)] },
    {value : 'xyzact' , expected_value_list : [...random_range_generator(0,1250)]}
]

const fs = require('fs')


function* log_generator() {

    let start_time = new Date().getTime()

    while (true) {
        let random_iterations = Math.floor(Math.random() * 10) + 1
        let time = Math.floor(Math.random()*50)+120
        let shdr_string = `${new Date(start_time+time).toISOString()}`
        for (let counter = 0; counter < random_iterations; counter++) {
            let random_event = Math.floor(Math.random() * values.length)
            let key = values[random_event].value
            let pair = values[random_event].expected_value_list[Math.floor(Math.random() * values[random_event].expected_value_list.length)]
            shdr_string += `|${key}|${pair}`
        }
        yield shdr_string+'\n'
    }
}


const max_count = 100000
let value = ''
for(let counter = 0 ; counter < max_count ; counter+=1){
    console.log(`Writing ${counter} of ${max_count}`)
    value += log_generator().next().value
}

fs.writeFile('haas_dump.txt',value , {flag : 'a+' , encoding : 'utf-8'} , error=>{})

