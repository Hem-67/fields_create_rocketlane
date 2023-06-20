const fs = require('fs');
const axios = require('axios');
const csv = require('csv-parser');
const Bottleneck = require('bottleneck');
const dotenv = require('dotenv');
dotenv.config();


const limiter = new Bottleneck({
    maxConcurrent: 1, // Number of concurrent requests to send
    minTime: 1000, // Minimum time (in milliseconds) to wait between requests
});

async function getPayload(fields, ids) {
    if (fields['Field Type'] == 'Text') {
        return {
            "fieldLabel": fields['Field Name'],
            "description": fields['Comments'],
            "private": true,
            "objectType": "PROJECT",
            "fieldType": "SINGLE_SELECT",
            "fieldDataType": "TEXT",
            "fieldSectionId": ids[0].fieldSectionId
        };

    }
    if (fields['Field Type'] == 'User') {
        return {
            "fieldLabel": fields['Field Name'],
            "description": fields['Comments'],
            "private": true,
            "objectType": "PROJECT",
            "fieldType": "SINGLE_SELECT",
            "fieldDataType": "USER",
            "fieldSectionId": ids[0].fieldSectionId
        };
    }
    if (fields['Field Type'] == 'Date') {
        return {
            "fieldLabel": fields['Field Name'],
            "description": fields['Comments'],
            "private": true,
            "objectType": "PROJECT",
            "fieldType": "SINGLE_SELECT",
            "fieldDataType": "DATE",
            "fieldSectionId": ids[0].fieldSectionId
        };
    }
    if (fields['Field Type'] == 'Text (Number)') {
        return {
            "fieldLabel": fields['Field Name'],
            "description": fields['Comments'],
            "private": true,
            "objectType": "PROJECT",
            "fieldType": "SINGLE_SELECT",
            "fieldDataType": "NUMBER",
            "fieldSectionId": ids[0].fieldSectionId
        };
    }
    if (fields['Field Type'] == 'Checkbox') {
        return {
            "fieldLabel": fields['Field Name'],
            "description": fields['Comments'],
            "private": true,
            "objectType": "PROJECT",
            "fieldType": "SINGLE_SELECT",
            "fieldDataType": "BOOLEAN",
            "fieldSectionId": ids[0].fieldSectionId
        };
    }
    if (fields['Field Type'] == 'Single Select Dropdown') {
        let choice = fields['Field Options'].split(',')
        let opt = [];
        for (let i = 0; i < choice.length; i++) {
            opt.push({
                "deletable": true,
                "editable": true,
                "label": choice[i],
                "color": "COLOR_NAME",
                "position": i + 1
            })
        }
        return {
            "fieldLabel": fields['Field Name'],
            "description": fields['Comments'],
            "private": true,
            "objectType": "PROJECT",
            "metaData": {
                "options": opt
            },
            "fieldType": "SINGLE_SELECT",
            "fieldDataType": "TEXT",
            "fieldSectionId": ids[0].fieldSectionId
        };
    }
    if (fields['Field Type'] == 'Multi Select Dropdown') {
        let choice = fields['Field Options']?.split(',') || [];
        let opt = [];
        for (let i = 0; i < choice.length; i++) {
            opt.push({
                "deletable": true,
                "editable": true,
                "label": choice[i],
                "color": "COLOR_NAME",
                "position": i + 1
            })
        }
        return {
            "fieldLabel": fields['Field Name'],
            "description": fields['Comments'],
            "private": true,
            "objectType": "PROJECT",
            "metaData": {
                "options": opt
            },
            "fieldType": "MULTI_SELECT",
            "fieldDataType": "TEXT",
            "fieldSectionId": ids[0].fieldSectionId
        };
    }
}


async function createTicket(fields, sections) {

    try {
        let ids = sections.filter((sectionName) => {
            return sectionName.fieldSectionName == fields['Section'];
        })

        let data = await getPayload(fields, ids);
        if (data) {
            let config = {
                method: 'post',
                url: `${process.env.fields_url}`,
                headers: {
                    'api-key': `${process.env.apikey}`,
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(data)
            };
            let response = await axios(config);
            console.log('Field Name :: ', response.data.fieldName)
        }


    } catch (error) {
        console.log('error', error.response.data)
        if (error.response && error.response.status === 429 || error.response.status === 403) {
            console.log('Rate limit exceeded. Waiting before retrying...');
            await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds
            return createTicket(fields, sections); // Retry the request
            // throw new Error(e);
        }
    }

    // console.log(`End ------------------- ${ticket.ticket_id}`)
}




async function createTickets() {
    let sections = [];
    let filds = [];

    fs.createReadStream('testfield.csv')
        .pipe(csv())
        .on('data', (row) => {
            sections.push(row['Section']);
            filds.push(row)
        })
        .on('end', async () => {
            sections = [...new Set(sections)]
            console.log('===================== Process Start');
            let finalArray = [];
            for (let i = 0; i < sections.length; i++) {
                let filter = filds.filter((filterData) => {
                    return sections[i] === filterData['Section']
                });
                finalArray.push({ [filter[0]['Section']]: filter });
            }
            for (let i = 0; i < sections.length; i++) {
                let data = JSON.stringify({
                    "fieldSectionName": sections[i],
                    "fieldSectionType": "PROJECT",
                    "private": false
                });
                let config = {
                    method: 'post',
                    url: `${process.env.section_url}`,
                    headers: {
                        'api-key': `${process.env.apikey}`,
                        'Content-Type': 'application/json'
                    },
                    data: data
                };
                await axios(config);
            }

            let config = {
                method: 'get',
                url: `${process.env.get_all_section}`,
                headers: {
                    'api-key': `${process.env.apikey}`,
                    'Content-Type': 'application/json'
                }
            };
            let overallSections = await axios(config);
            for (const fields of filds.slice(0, 300)) {
                await limiter.schedule(() => createTicket(fields, overallSections.data));
            }

            console.log('===================== Process End');

        });
}


createTickets();
