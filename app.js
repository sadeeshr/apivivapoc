const app = require('express')()
const httpServer = require('http').createServer(app).listen(8080) // HTTP
const bodyParser = require('body-parser')
const builder = require('xmlbuilder');
const util = require('util');
const request = require('request');
const got = require('got');

const baseUrl = "https://labtest.gofrugal.com/call_center/cloudCall.php"
const headers = { 'X-Api-Key': "e72bb2cb-4003-4e93-ba6a-abaf59a2615b" }

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
                // if (req.body['Event-Calling-Function'] === "dialplan_xml_locate") {
                //     dialplan.getDialPlanContext(req.body, function (err, data) {
                //         if (err) {
                //             console.log(err);
                //             toXML(notFound, function (result) {
                //                 cb(result);
                //             });
                //         }
                //         else {
                //             cb(data);
                //         }
                //     });
                // } else {
                toXML(notFound, function (result) {
                    cb(result);
                });
                // }
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

function execAPI(url) {
    console.log(url, headers);
    (async () => {
        try {
            const response = await got(url, { headers });
            console.log("RES", response.body);
        } catch (error) {
            console.log("ERR", error.response.body);
        }
    })();
}

// let testURL = `${baseUrl}?caller=1234567890&transactionid=abcd1234&called=9876543210&call_type=incoming&location=tamilnadu`
// execAPI(testURL)