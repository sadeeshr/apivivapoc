local http_request = require "http.request"
local stringy = require "stringy"
local neturl = require "net.url"

local baseUrl = "https://labtest.gofrugal.com/call_center"
local baseFile = "cloudCall.php"

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

function isempty(s)
    return s == nil or s == ""
end

function surveyHandler(s, status, arg)
    freeswitch.consoleLog("NOTICE", "myHangupHook: " .. status .. "\n")
    session:execute("hangup")
end

function dialHandler(destination, uuid, number)
    session:setVariable("ringback", "${in-ring}")
    session:setVariable("hangup_after_bridge", "true")
    session:setVariable("continue_on_fail", "true")
    session:setVariable("media_bug_answer_req", "true")

    local url =
        baseUrl ..
        "/cloudCallAgentStatusUpdate.php?transactionid=" .. uuid .. "&agent_number=" .. number .. "&agent_status_id="
    local call = freeswitch.Session(destination, session)

    executeUrl(url .. "4")

    -- Check to see if the call was answered
    if call:ready() then
        -- Do something good here
        call:setHangupHook("surveyHandler", "survey")
    else -- This means the call was not answered ... Check for the reason
        local cause = call:hangupCause()
        freeswitch.consoleLog("info", "call => hangupCause() = " .. cause)
        if (cause == "USER_BUSY") then -- SIP 486
            -- For BUSY you may reschedule the call for later
        elseif (cause == "NO_ANSWER") then
            -- Call them back in an hour
        elseif (cause == "ORIGINATOR_CANCEL") then -- SIP 487
            -- May need to check for network congestion or problems
        else
            -- Log these issues
        end
    end

    executeUrl(url .. "5")

    session:execute("hangup")
end

function ivrHandler(audio, dtmf, purpose)
    local invalid = "ivr/ivr-that_was_an_invalid_entry.wav"
    local digitsRange = stringy.split(dtmf, "-")
    -- session:setAutoHangup(false)
    local retries = 3
    local digits = nil
    repeat
        session:execute("playback", audio)
        digits = session:read(1, 1, audio, 3000, "#")
        retries = retries - 1
        if
            retries > 0 and
                not (tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]))
         then
            session:execute("playback", invalid)
        end
        session:consoleLog("info", "Got dtmf: " .. digits .. "\n")
    until retries == 0 or tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2])
    if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
        session:setVariable("ivr_purpose", purpose)
        session:setVariable("key_press", digits)
        execAPI_3(purpose, digits)
    else
        session:hangup()
    end
end

function handleResponse(response)
    local code, dial, voiceMessage, keyPressValue, purpose = response
    if code == "200" then
        console("dial handler")
        local number = dial.sub(-10)
        local destination = "sofia/gateway/" .. gateway .. "/91" .. number
        dialHandler(destination, uuid, number)
    elseif code == "201" then
        console("ivr handler")
        ivrHandler(voiceMessage, keyPressValue, purpose)
    else
        console("playback handler")
        session:execute("playback", voiceMessage)
        session:hangup()
    end
end

function executeUrl(url)
    freeswitch.consoleLog("debug", url .. "\n")
    local req = http_request.new_from_uri(url)
    local req_timeout = 10
    req.headers:upsert("X-Api-Key", "e72bb2cb-4003-4e93-ba6a-abaf59a2615b")
    local headers, stream = req:go(req_timeout)
    local body, err = stream:get_body_as_string()
    if headers:get ":status" ~= "200" then
        error(body)
    end
    freeswitch.consoleLog("debug", body .. "\n")
    body = "code=" .. body
    local resbody = res:gsub("|", "&")
    local res = neturl.parseQuery(resbody)
    printTable(res)
    handleResponse(res)
end

function execAPI_1()
    local caller = session:getVariable("caller_id_number")
    local called = session:getVariable("destination_number")
    local uuid = session:getVariable("uuid")

    local url =
        baseUrl ..
        "/" ..
            baseFile ..
                "?caller=" ..
                    caller ..
                        "&transactionid=" .. uuid .. "&called=" .. called .. "&call_type=IC&location=tamilnadu&pin=1"
    console(url)
    executeUrl(url)
end

function execAPI_3(purpose, keypress)
    local caller = session:getVariable("caller_id_number")
    local called = session:getVariable("destination_number")
    local uuid = session:getVariable("uuid")

    local url =
        baseUrl ..
        "/cloudIncomingCall.php?purpose=" ..
            purpose ..
                "&caller=" ..
                    caller ..
                        "&transactionid=" ..
                            uuid ..
                                "&called=" ..
                                    called .. "&call_type=IC&location=tamilnadu&keypress=" .. keypress .. "&pin=1"
    console(url)
    executeUrl(url)
end

session:answer()

while (session:ready() == true) do
    session:setVariable("media_bug_answer_req", "true")
    session:execute("record_session", "$${recordings_dir}/${uuid}.mp3")
    session:execute("playback", welcomeMessage)

    execAPI_1()
end

--local crmres ="https://labtest.gofrugal.com/call_center/cloudCall.php?caller=9880647468&transactionid=d580a659-4bd3-4d4c-878b-06d99685fb7a&called=914466455978&call_type=IC&location=tamilnadu&pin=1"
