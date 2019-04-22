const app = require('express')()
const httpServer = require('http').createServer(app).listen(8080) // HTTP
const bodyParser = require('body-parser')
const builder = require('xmlbuilder');
const util = require('util');
const got = require('got');

const baseUrl = "https://labtest.gofrugal.com/call_center/cloudCall.php"
const headers = { 'X-Api-Key': "e72bb2cb-4003-4e93-ba6a-abaf59a2615b" }

const welcomeMessage = "https://download.gofrugal.com/ivr/AudioFiles/welcome-to-gft-I.wav"
const testVoice = "1234567890"
const testDial = "9629845692"
const gateway = "VIVA"
const DIDs = [
    "914466455977", // Inbound
    "914466455978", // Outbound
]

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

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

                if ((eventFunction === "dialplan_xml_locate") && DIDs.includes(called)) {
                    console.log(dtmf, purpose);
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
                    let url = `${baseUrl}?caller=${caller}&transactionid=${uuid}&called=${called}&call_type=${direction}&location=tamilnadu&pin=1`
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
    const { body } = req
    const { variables: cdr } = body
    console.log(cdr);

    const { call_uuid: uuid, sip_from_user: caller, sip_to_user: called, start_epoch: starttime, end_epoch: endtime, progresssec: ringtime, duration } = cdr
    let url = `${baseUrl}?caller=${caller}&transactionid=${uuid}&called=${called}&dialer=${"9876543210"}&location=tamilnadu&keypress=&starttime=${starttime}&endtime=${endtime}&ringtime=${ringtime}&duration=${duration}&call_type=CH&recordpath=&hangupfirst=${"9876543210"}&country=IN`
    // let url = `${baseUrl}?caller=${caller}&transactionid=${uuid}&called=${"9876543210"}&dialer=${"9876543210"}&location=tamilnadu&keypress=&starttime=${starttime}&endtime=${endtime}&ringtime=${ringtime}&duration=${duration}&call_type=CH&recordpath=&hangupfirst=${"9876543210"}&country=IN`
    execAPI(null, url, res => {
        console.log(res)
        cb(200)
    })

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
    switch (code) {
        case "200":
            dialResponseFeeder(dial, res => cb(res))
            break;
        case "201":
        case "204":
            {
                // ivrResponseFeeder(voiceMessage, "1-2", "unknown_call_transfer", res => cb(res))
                ivrResponseFeeder(called, voiceMessage, keyPressValue, purpose, res => cb(res))
                break;
            }
        case "202":
        case "203":
        case "205":
        case "300":
        case "301":
            voiceResponseFeeder(called, voiceMessage, res => cb(res))
            break;
        default:
            cb(generateAction("hangup"))
            break;
    }
}


function dialResponseFeeder(data = "", cb) {
    let phone = data.split(",")
    let destination = phone.map(num => `sofia/gateway/${gateway}/${num}`)
    let actions = []

    actions.push(generateAction("pre_answer"))
    actions.push(generateAction("set", "instant_ringback=true"))
    actions.push(generateAction("set", "ringback=${in-ring}"));
    actions.push(generateAction("set", "call_timeout=30"));
    actions.push(generateAction("set", "hangup_after_bridge=true"));
    actions.push(generateAction("set", "continue_on_fail=true"));
    actions.push(generateAction("bridge", destination));
    // actions.push(generateAction("sleep", "1000"));
    actions.push(generateAction("hangup"))

    cb(actions)
}

function voiceResponseFeeder(called, data = "", cb) {
    let actions = []

    actions.push(generateAction("answer"))
    if (called === "914466455977") actions.push(generateAction("playback", welcomeMessage));
    actions.push(generateAction("set", "hangup_after_bridge=true"));
    actions.push(generateAction("set", "continue_on_fail=true"));
    actions.push(generateAction("playback", data));
    // actions.push(generateAction("sleep", "1000"));
    actions.push(generateAction("hangup"))

    cb(actions)
}

function ivrResponseFeeder(called, voiceMessage, keyPressValue, purpose, cb) {
    let actions = []
    let invalid = "ivr/ivr-that_was_an_invalid_entry.wav"
    let data = `1 1 3 3000 # ${voiceMessage} ${invalid} key_press [${keyPressValue}]`

    actions.push(generateAction("answer"))
    if (called === "914466455977") actions.push(generateAction("playback", welcomeMessage));
    actions.push(generateAction("set", `ivr_purpose=${purpose}`));
    actions.push(generateAction("play_and_get_digits", data));
    // actions.push(generateAction("sleep", "1000"));
    actions.push(generateAction("transfer", "$1 XML default"))
    // actions.push(generateAction("hangup"))    

    cb(actions)
}
// simulation
// let url = `${baseUrl}?caller=${"1234567890"}&transactionid=abcd1234&called=${"9876543210"}&call_type=IC&location=tamilnadu&pin=1&purpose=unknown_call_transfer`
// execAPI(url, action => console.log(util.inspect(action, false, null, true)))

// { code: '201',
//   voiceMessage: 'filename.mp3',
//   keyPress: 'true',
//   keyPressValue: '1-3',
//   purpose: 'unknown_call_transfer' }
