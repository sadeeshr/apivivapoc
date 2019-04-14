const app = require('express')()
const httpServer = require('http').createServer(app).listen(8080) // HTTP
const bodyParser = require('body-parser')
const builder = require('xmlbuilder');
const util = require('util');
const request = require('request');
const got = require('got');

const baseUrl = "https://labtest.gofrugal.com/call_center/cloudCall.php"
const headers = { 'X-Api-Key': "e72bb2cb-4003-4e93-ba6a-abaf59a2615b" }

const testVoice = "1234567890"
const testDial = "9629845692"

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.post('/api/system', function (req, res) {
    console.log(req.body);
    dialPlanHandler(req, function (result) {
        // console.log(result);
        res.send(result);
    });

});

function dialPlanHandler(req, cb) {
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
    switch (req.body.section) {
        case "dialplan":
            {
                if (req.body['Event-Calling-Function'] === "dialplan_xml_locate") {
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
                    let url = `${baseUrl}?caller=${testVoice}&transactionid=abcd1234&called=9876543210&call_type=IC&location=tamilnadu&pin=1`
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
            console.log("ERR", error.response.body);
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
    const [cmd = "", param = ""] = res.split("=")
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
    let destination = phone.map(num => `sofia/gateway/gwname/${num}`)
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

// let testURL = `${baseUrl}?caller=1234567890&transactionid=abcd1234&called=9876543210&call_type=incoming&location=tamilnadu`
// execAPI(testURL)

