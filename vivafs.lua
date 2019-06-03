local http_request = require "http.request"
local stringy = require "stringy"
local neturl = require "net.url"

local baseUrl = "https://labtest.gofrugal.com/call_center"
local baseFile = "cloudCall.php"
local statusBaseFile = "cloudCallAgentStatusUpdate.php"

local welcomeMessage = "https://download.gofrugal.com/ivr/AudioFiles/welcome-to-gft-I.wav"
local gateway = "VIVA"

function printTable(data)
    for k, v in pairs(data) do
        freeswitch.consoleLog("debug", k .. " : " .. v)
    end
end

function console(data)
    freeswitch.consoleLog("debug", data)
end

function ivrHandler(session, audio)
    session:answer()
    while (session:ready() == true) do
        session:setAutoHangup(false)
        session:execute("playback", audio)
        -- session:setVariable("media_bug_answer_req","true");
        -- digits = session:read(1, 1, "misc/misc-cudatel_communication_server_from_barracuda.wav", 3000, "#");
        -- session:consoleLog("info", "Got dtmf: ".. digits .."\n");
        -- if tonumber(digits) >= 1 and tonumber(digits) <=3 then
        --     session:execute("playback", "ivr/ivr-thank_you_for_calling.wav")
        -- else
        --     session:execute("playback", "ivr/ivr-im_sorry.wav")
        -- end
        session:hangup()
        -- if (digits == "1")  then
        --     session:execute("transfer","9888");
        -- end
        -- if (digits == "2")  then
        --     session:execute("transfer","5000");
        -- end
        -- if (digits == "3")  then
        --     session:execute("transfer","4000");
        -- end
        -- if (digits == "4")  then
        --     session:execute("transfer","9999");
        -- end
        -- if (digits == "0")  then
        --     session:execute("transfer","voipaware@sip.voipuser.org");
        -- end
    end
end

function executeUrl(url)
    local req = http_request.new_from_uri(url)
    local req_timeout = 10
    req.headers:upsert(":X-Api-Key", "e72bb2cb-4003-4e93-ba6a-abaf59a2615b")
    local headers, stream = req:go(req_timeout)
    local body, err = stream:get_body_as_string()
    if headers:get ":status" ~= "200" then
        error(body)
    end
    --    freeswitch.consoleLog("debug",  body.."\n");
    local resbody = stringy.split(body, "|")
    local res = neturl.parseQuery(resbody[2])
    printTable(res)
    return res
end

session:answer()

while (session:ready() == true) do
    local caller = session:getVariable("caller_id_number")
    local called = session:getVariable("destination_number")
    local uuid = session:getVariable("uuid")
    local url =
        baseUrl ..
        baseFile ..
            "?caller=" ..
                caller .. "&transactionid=" .. uuid .. "&called=" .. called .. "&call_type=IC&location=tamilnadu&pin=1"
    console(url)
    local crmres = executeUrl(url)

    if crmres["code"] == "200" then
        console("dial handler")
    elseif crmres["code"] == "201" then
        console("ivr handler")
        ivrHandler(session, crmres["voiceMessage"])
    else
        console("playback handler")
        session:execute("playback", crmres["voiceMessage"])
    end
    session:hangup()
end

--local crmres ="https://labtest.gofrugal.com/call_center/cloudCall.php?caller=9880647468&transactionid=d580a659-4bd3-4d4c-878b-06d99685fb7a&called=914466455978&call_type=IC&location=tamilnadu&pin=1"
