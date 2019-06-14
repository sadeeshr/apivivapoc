const app = require('express')()
const httpServer = require('http').createServer(app).listen(8080) // HTTP
const bodyParser = require('body-parser')
const builder = require('xmlbuilder');
const util = require('util');
const got = require('got');
const esl = require('modesl');

const baseUrl = "https://labtest.gofrugal.com/call_center"
let baseFile = "cloudCall.php"
let statusBaseFile = "cloudCallAgentStatusUpdate.php"

const headers = { 'X-Api-Key': "e72bb2cb-4003-4e93-ba6a-abaf59a2615b" }

const welcomeMessage = "https://download.gofrugal.com/ivr/AudioFiles/welcome-to-gft-I.wav"
const gateway = "VIVA"
const inboundDIDs = [
    "914466455977",
]
const outboundDIDs = [
    "914466455978",
]

let FS = null;

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.get('/api/recording/:id', function (req, res) {
    const { params } = req
    const { id } = params
    const recordingsPath = "/var/lib/freeswitch/recordings/"
    res.download(`${recordingsPath}${id}.mp3`);
});

// app.get('/api/status/:uuid/:agent_number/:agent_status_id', function (req, res) {
//     const { params } = req
//     const { uuid, agent_number, agent_status_id } = params

//     let url = `${baseUrl}/${statusBaseFile}?transactionid=${uuid}&agent_number=${agent_number}&agent_status_id=${agent_status_id}`

//     execAPI(called, url, action => {
//         extension.condition.action = action;
//         dialplan.document.section.context.extension = extension;
//         toXML(dialplan, function (xmlResult) {
//             cb(xmlResult);
//         });
//     })
//     res.download(`${recordingsPath}${id}.mp3`);
// });

app.post('/api/system', function (req, res) {
    // console.log(req.body);
    dialPlanHandler(req, function (result) {
        res.send(result);
    });

});

app.post('/api/cdr', function (req, res) {
    cdrHandler(req, function (result) {
        res.sendStatus(result);
    });
});

function dialPlanHandler(req, cb) {
    const { body } = req
    const { section } = body
    const notFound = {
        "document": {
            "@type": "freeswitch/xml",
            "section": {
                "@name": "result",
                "result": {
                    "@status": "not found"
                }
            }
        }
    }
    switch (section) {
        case "dialplan":
            {
                const uuid = body["Channel-Call-UUID"]
                const direction = (body["Call-Direction"] === "inbound") ? "IC" : "OC"
                const caller = body["Caller-Caller-ID-Number"]
                const called = body["Caller-Destination-Number"]
                const context = body["Caller-Context"]
                const dtmf = body["variable_key_press"]
                const purpose = body["variable_ivr_purpose"]
                const eventFunction = body['Event-Calling-Function']
                const DIDs = [...inboundDIDs, ...outboundDIDs]

                if ((eventFunction === "dialplan_xml_locate") && DIDs.includes(called)) {
                    console.log(dtmf, purpose);
                    if (dtmf)
                        baseFile = "cloudIncomingCall.php"
                    else
                        baseFile = "cloudCall.php"

                    let dialplan = {
                        "document": {
                            "@type": "freeswitch/xml",
                            "section": {
                                "@name": "dialplan",
                                "@description": "Dial Plan",
                                "context": {
                                    "@name": context,
                                    "extension": []
                                }
                            }
                        }
                    };

                    let extension = {
                        "@name": "dialplan_routing",
                        "condition": {
                            "@field": "destination_number",
                            "@expression": "^(\\+?\\d+)$",
                            "action": []
                        }
                    }
                    let url = `${baseUrl}/${baseFile}?caller=${caller}&transactionid=${uuid}&called=${called}&call_type=${direction}&location=tamilnadu&pin=1`
                    // let url = `${baseUrl}?caller=${caller}&transactionid=${uuid}&called=${"9876543210"}&call_type=${direction}&location=tamilnadu&pin=1`
                    if (dtmf)
                        url += `&purpose=${purpose}&keypress=${dtmf}`
                    if (purpose && !dtmf) {
                        extension.condition.action = generateAction("hangup");
                        dialplan.document.section.context.extension = extension;
                        toXML(dialplan, function (xmlResult) {
                            cb(xmlResult);
                        });
                    } else
                        execAPI(called, url, action => {
                            extension.condition.action = action;
                            dialplan.document.section.context.extension = extension;
                            toXML(dialplan, function (xmlResult) {
                                cb(xmlResult);
                            });
                        })
                } else {
                    toXML(notFound, function (result) {
                        cb(result);
                    });
                }
            }
            break;
        default:
            toXML(notFound, function (result) {
                cb(result);
            });
            break;
    }
}

function cdrHandler(req, cb) {
    const DIDs = [...inboundDIDs, ...outboundDIDs]
    const { body } = req
    const { variables: cdr } = body
    let { agent_dial_time, agent_answered_time, agent_hangup_time, answer_epoch, call_uuid: uuid, sip_from_user: caller, sip_to_user: called, start_epoch: starttime, end_epoch: endtime, answersec: ringtime, duration = 0, billsec = 0, bridge_channel, sip_hangup_disposition: hangup_direction, key_press = "", csat_key_press } = cdr
    const sendCdr = DIDs.includes(called)

    if (sendCdr) {
        console.log(cdr);
        // if (Number(billsec) === 0)
        // ringtime = duration
        if (agent_dial_time) {
            agent_dial_time = Math.round(Number(agent_dial_time) / 1000)
        }
        if (agent_answered_time) {
            agent_answered_time = Math.round(Number(agent_answered_time) / 1000)
            agent_hangup_time = agent_hangup_time ? Math.round(Number(agent_hangup_time) / 1000) : endtime
            // billsec = Number(end_epoch) - agent_answered_time
            billsec = agent_hangup_time - agent_answered_time
            ringtime = (agent_answered_time - (agent_dial_time || Number(answer_epoch))) + Number(ringtime)
        } else {
            billsec = 0
            ringtime = Number(end_epoch) - (agent_dial_time || Number(answer_epoch))
        }
        baseFile = "cloudCall.php"
        const dialer = bridge_channel ? bridge_channel.split("/").pop() : ""
        const hangupfirst = hangup_direction.startsWith("send_") ? called : (dialer || caller)
        const recording_path = (agent_answered_time && (Number(billsec) > 0)) ? `http://gofrugaldemo.vivacommunication.com:8080/api/recording/${uuid}` : ""

        let url = `${baseUrl}/${baseFile}?caller=${caller}&transactionid=${uuid}&called=${called}&dialer=${dialer}&location=tamilnadu&keypress=${key_press}&starttime=${starttime}&endtime=${endtime}&ringtime=${ringtime}&duration=${duration}&billsec=${billsec}&call_type=CH&recordpath=${recording_path}&hangupfirst=${hangupfirst}&country=IN`
        // let url = `${baseUrl}?caller=${caller}&transactionid=${uuid}&called=${"9876543210"}&dialer=${"9876543210"}&location=tamilnadu&keypress=&starttime=${starttime}&endtime=${endtime}&ringtime=${ringtime}&duration=${duration}&call_type=CH&recordpath=&hangupfirst=${"9876543210"}&country=IN`

        // if (csat_key_press) {
        //     let csat_url = `${baseUrl}/ismile/dsl_submit.php?cloud_call=1&transactionid=${uuid}&keypress=${csat_key_press}&purpose=ticket_rating`
        //     execAPI(null, csat_url, res => console.log(res))
        // }

        execAPI(null, url, res => { console.log(res); cb(200) })

    } else
        cb(200)

}

function toXML(data, cb) {
    console.log("to xml data: ");
    console.log(util.inspect(data, false, null, true))

    var feed = builder.create(data, { encoding: 'utf-8' });
    var result = feed.end({ pretty: true });
    cb(result);
}

function generateAction(application, data, inline) {
    var action = {
        "@application": application,
    };
    if (data)
        action["@data"] = data;
    if (inline)
        action["@inline"] = true;
    return action;
}

function execAPI(called, url, cb) {
    console.log(called, url, headers);
    (async () => {
        try {
            const response = await got(url, { headers });
            const { body } = response
            console.log("RES", body);
            if (called)
                handleResponseCode(called, body, res => cb(res))
            else
                cb(1)
        } catch (error) {
            console.log("ERR", error);
        }
    })();
}

function handleResponseCode(called, data = "", cb) {
    const response = Object.assign({}, ...data.split("|").map(i => i.includes("=") ? ({ [i.split("=")[0]]: i.split("=")[1] }) : ({ code: i })))
    const { code, dial, voiceMessage, keyPress, keyPressValue, purpose } = response
    const inbound = inboundDIDs.includes(called)
    switch (code) {
        case "200":
            dialResponseFeeder(dial, inbound, res => cb(res))
            break;
        case "201":
        case "204":
            {
                // ivrResponseFeeder(voiceMessage, "1-2", "unknown_call_transfer", res => cb(res))
                ivrResponseFeeder(voiceMessage, keyPressValue, purpose, inbound, res => cb(res))
                break;
            }
        case "202":
        case "203":
        case "205":
        case "300":
        case "301":
            voiceResponseFeeder(voiceMessage, inbound, res => cb(res))
            break;
        default:
            cb(generateAction("hangup"))
            break;
    }
}


function dialResponseFeeder(data = "", inbound, cb) {
    let phone = data.split(",")
    let dialing_number = phone[0]
    let destination = phone.map(num => `sofia/gateway/${gateway}/91${num.substr(-10, 10)}`)
    let actions = []
    let url = baseUrl + '/' + statusBaseFile + '?transactionid=${uuid}&agent_number=' + dialing_number + '&agent_status_id='

    actions.push(generateAction("answer")) //pre_answer
    // actions.push(generateAction("set", "instant_ringback=true"))
    actions.push(generateAction("set", "ringback=${in-ring}"));
    // actions.push(generateAction("set", "ignore_early_media=true"));
    // actions.push(generateAction("set", "call_timeout=30"));
    actions.push(generateAction("set", "session_in_hangup_hook=true", true));

    actions.push(generateAction("set", "hangup_after_bridge=true"));
    actions.push(generateAction("set", "continue_on_fail=true"));
    actions.push(generateAction("set", "media_bug_answer_req=true"));
    actions.push(generateAction("set", `api_after_bridge=bg_system '/usr/bin/curl ${url}5'`, true));           // set BUSY
    actions.push(generateAction("set", `api_hangup_hook=bg_system '/usr/bin/curl ${url}4'`, true));            // set FREE
    actions.push(generateAction("export", "nolocal:api_on_answer=uuid_setvar ${uuid} agent_answered_time ${strepoch()}"));

    if (inbound) actions.push(generateAction("set", `exec_after_bridge_app=ivr`));               // C-SAT IVR
    if (inbound) actions.push(generateAction("set", `exec_after_bridge_arg=gf_csat_ivr`));       // gf_csat_ivr

    actions.push(generateAction("record_session", "$${recordings_dir}/${uuid}.mp3"));

    actions.push(generateAction("bridge", destination));
    actions.push(generateAction("hangup"))

    cb(actions)
}

function voiceResponseFeeder(data = "", inbound, cb) {
    let actions = []

    actions.push(generateAction("set", "media_bug_answer_req=true"));
    actions.push(generateAction("answer"))
    actions.push(generateAction("record_session", "$${recordings_dir}/${uuid}.mp3"));
    if (inbound) actions.push(generateAction("playback", welcomeMessage));
    actions.push(generateAction("set", "hangup_after_bridge=true"));
    actions.push(generateAction("set", "continue_on_fail=true"));
    actions.push(generateAction("playback", data));
    // actions.push(generateAction("sleep", "1000"));
    actions.push(generateAction("hangup"))

    cb(actions)
}

function ivrResponseFeeder(voiceMessage, keyPressValue, purpose, inbound, cb) {
    let actions = []
    let invalid = "ivr/ivr-that_was_an_invalid_entry.wav"
    let silence = "silence_stream://300"   // 300 ms
    // let data = `1 1 3 3000 # ${voiceMessage} ${invalid} key_press [${keyPressValue}]`
    let data = `1 1 3 3000 # ${voiceMessage} ${silence} key_press [${keyPressValue}]`

    actions.push(generateAction("set", "media_bug_answer_req=true"));
    actions.push(generateAction("answer"))
    actions.push(generateAction("record_session", "$${recordings_dir}/${uuid}.mp3"));
    if (inbound) actions.push(generateAction("playback", welcomeMessage));
    actions.push(generateAction("set", `ivr_purpose=${purpose}`));
    actions.push(generateAction("play_and_get_digits", data));
    // actions.push(generateAction("sleep", "1000"));
    actions.push(generateAction("transfer", "$1 XML default"))
    // actions.push(generateAction("hangup"))    

    cb(actions)
}

// FS = new esl.Connection('127.0.0.1', 8021, 'ClueCon', () => {
//     if (FS.connected()) {
//         console.log("FS Connected")
//         subscribeEvents();
//     }
// });
// FS.on('error', (err) => {
//     if (FS) FS = null;
//     console.log("FS connection failed: ", err);
// });

// function subscribeEvents() {
//     console.log("Subscribing to Events");
//     try {
//         FS.subscribe(
//             [
//                 'CHANNEL_ORIGINATE',
//                 'CHANNEL_ANSWER',
//                 'CHANNEL_HANGUP'
//             ],
//             function () {
//                 FS.on('esl::event::CHANNEL_ORIGINATE::*', function (evt) { channelsEventsHandler(evt) });
//                 FS.on('esl::event::CHANNEL_ANSWER::*', function (evt) { channelsEventsHandler(evt) });
//                 FS.on('esl::event::CHANNEL_HANGUP::*', function (evt) { channelsEventsHandler(evt) })
//             })
//     } catch (err) {
//         console.log("### FS EXEC ERROR ###: ", err);
//     }
// }

// function channelsEventsHandler(evt) {
//     // var uniqueId = evt.getHeader('Unique-ID');
//     // var callId = evt.getHeader('Channel-Call-UUID');
//     var eventName = evt.getHeader('Event-Name');
//     // const timestamp = Math.floor(evt.getHeader('Event-Date-Timestamp') / 1E6)
//     // var context = evt.getHeader('Caller-Context')
//     // var destination = evt.getHeader('variable_sip_to_user') || evt.getHeader('Caller-Destination-Number')
//     // var domain = evt.getHeader('variable_domain_name') || evt.getHeader('variable_dialed_domain') || evt.getHeader('variable_sip_req_host') || evt.getHeader('variable_sip_to_host')
//     // var cid_num = evt.getHeader('Caller-Caller-ID-Number')
//     // var callee_num = evt.getHeader('Caller-Callee-ID-Number')
//     // // callRow.state = evt.getHeader('Channel-State');
//     // // callRow.callstate = evt.getHeader('Channel-Call-State');
//     // // callRow.answerstate = evt.getHeader('Answer-State');
//     // // callRow.hit_dialplan = evt.getHeader('Channel-HIT-Dialplan');

//     switch (eventName) {
//         case "CHANNEL_ORIGINATE":
//             {
//                 console.log("CHANNEL CREATE EVENT", evt);
//                 break;
//             }

//         case "CHANNEL_ANSWER":
//             {
//                 console.log("CHANNEL ANSWER EVENT", evt);
//                 break;
//             }

//         case "CHANNEL_HANGUP":
//             {
//                 console.log("CHANNEL HANGUP EVENT", evt);
//                 break;
//             }

//         default:
//             break;
//     }
// }