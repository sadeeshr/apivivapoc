const app = require('express')()
const httpServer = require('http').createServer(app).listen(8080) // HTTP
const bodyParser = require('body-parser')
const builder = require('xmlbuilder');
const util = require('util');
const got = require('got');

const baseUrl = "https://labtest.gofrugal.com/call_center/cloudCall.php"
const headers = { 'X-Api-Key': "e72bb2cb-4003-4e93-ba6a-abaf59a2615b" }

const testVoice = "1234567890"
const testDial = "9629845692"
const gateway = "VIVA"

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.post('/api/system', function (req, res) {
    console.log(req.body);
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
                if (body['Event-Calling-Function'] === "dialplan_xml_locate") {
                    const uuid = body["Channel-Call-UUID"]
                    const direction = (body["Call-Direction"] === "inbound") ? "IC" : "OC"
                    const caller = body["Caller-Caller-ID-Number"]
                    const called = body["Caller-Destination-Number"]

                    let dialplan = {
                        "document": {
                            "@type": "freeswitch/xml",
                            "section": {
                                "@name": "dialplan",
                                "@description": "Dial Plan",
                                "context": {
                                    "@name": "default",
                                    "extension": []
                                }
                            }
                        }
                    };

                    let extension = {
                        "@name": null,
                        "condition": {
                            "@field": "destination_number",
                            "@expression": "^(\\+?\\d+)$",
                            "action": []
                        }
                    }
                    // let url = `${baseUrl}?caller=${caller}&transactionid=${uuid}&called=${called}&call_type=${direction}&location=tamilnadu&pin=1`
                    let url = `${baseUrl}?caller=${caller}&transactionid=${uuid}&called=${"9876543210"}&call_type=${direction}&location=tamilnadu&pin=1`
                    execAPI(url, action => {
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
    // let url = `${baseUrl}?caller=${caller}&transactionid=${uuid}&called=${called}&dialer=${"9876543210"}&location=tamilnadu&keypress=&starttime=${starttime}&endtime=${endtime}&ringtime=${ringtime}&duration=${duration}&call_type=CH&recordpath=&hangupfirst=${"9876543210"}&country=IN`
    let url = `${baseUrl}?caller=${caller}&transactionid=${uuid}&called=${"9876543210"}&dialer=${"9876543210"}&location=tamilnadu&keypress=&starttime=${starttime}&endtime=${endtime}&ringtime=${ringtime}&duration=${duration}&call_type=CH&recordpath=&hangupfirst=${"9876543210"}&country=IN`
    execAPI(url, res => {
        console.log(res)
        cb(200)
    })

}

function toXML(data, cb) {
    console.log("to xml data: ");
    console.log(util.inspect(data, false, null))

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

function execAPI(url, cb) {
    console.log(url, headers);
    (async () => {
        try {
            const response = await got(url, { headers });
            const { body } = response
            console.log("RES", body);
            handleResponseCode(body, res => cb(res))
        } catch (error) {
            console.log("ERR", error);
        }
    })();
}

function handleResponseCode(data = "", cb) {
    const [code = "", action = ""] = data.split("|")
    console.log(code, action)

    switch (code) {
        case "200":
        case "204":
            {
                handleResponse(action, res => cb(res))
                break;
            }

        default:
            break;
    }
}

function handleResponse(data = "", cb) {
    const [cmd = "", param = ""] = data.split("=")
    switch (cmd) {
        case "dial":
            dialResponseFeeder(param, res => cb(res))
            break;
        case "voiceMessage":
            voiceResponseFeeder(param, res => cb(res))
            break;
        default:
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
    actions.push(generateAction("sleep", "1000"));
    // call transaction api here

    cb(actions)
}

function voiceResponseFeeder(data = "", cb) {
    let actions = []

    actions.push(generateAction("answer"))
    actions.push(generateAction("set", "hangup_after_bridge=true"));
    actions.push(generateAction("set", "continue_on_fail=true"));
    actions.push(generateAction("playback", data));
    actions.push(generateAction("sleep", "1000"));
    // call transaction api here

    cb(actions)
}


