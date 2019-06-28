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

function surveyHandler(s, url)
    freeswitch.consoleLog("NOTICE", "HangupHook: " .. url .. "\n")
    executeUrl(url, false)
    session:execute("hangup")
end

function dialHandler(destination, uuid, number)
    local called = session:getVariable("destination_number")
    session:execute("playback", welcomeMessage)

    session:setVariable("ringback", "${in-ring}")
    session:setVariable("hangup_after_bridge", "false")
    session:setVariable("continue_on_fail", "true")
    session:setVariable("media_bug_answer_req", "true")
    -- session:setVariable("exec_after_bridge_app", "lua")
    -- session:setVariable("exec_after_bridge_arg", "vivautil.lua ${uuid} setTime agent_hangup_time")

    session:execute("export", "nolocal:execute_on_originate=lua vivautil.lua " .. uuid .. " setTime agent_dial_time")
    session:execute("export", "nolocal:execute_on_answer=lua vivautil.lua " .. uuid .. " setTime agent_answered_time")
    local url =
        baseUrl ..
        "/cloudCallAgentStatusUpdate.php?transactionid=" .. uuid .. "&agent_number=" .. number .. "&agent_status_id="
    executeUrl(url .. "5", false)
    -- session:setHangupHook("surveyHandler", url .. "5")
    session:execute("bridge", destination)
    local cause = session:hangupCause()
    freeswitch.consoleLog("info", "call => hangupCause() = " .. cause)
    session:execute("lua", "vivautil.lua " .. uuid .. " setTime agent_hangup_time")
    executeUrl(url .. "4", false)
    local agent_answered = session:getVariable("agent_answered_time")
    if (called == "914466455977") and agent_answered then
        session:execute("lua", "vivasurvey.lua")
    end
    session:execute("hangup")

    -- Check to see if the call was answered
    -- if call:ready() then
    -- call:setHangupHook("surveyHandler", "survey")
    -- session:execute("hangup")
    -- Do something good here
    -- freeswitch.bridge(call, session)
    -- else -- This means the call was not answered ... Check for the reason

    --     if (cause == "USER_BUSY") then -- SIP 486
    --         -- For BUSY you may reschedule the call for later
    --     elseif (cause == "NO_ANSWER") then
    --         -- Call them back in an hour
    --     elseif (cause == "ORIGINATOR_CANCEL") then -- SIP 487
    --         -- May need to check for network congestion or problems
    --     else
    --         -- Log these issues
    --     end
    --     executeUrl(url .. "5", false)
    -- end
end

function getDigits(audio, dtmf)
    digits = session:playAndGetDigits(1, 1, 1, 3000, "", audio, "", "[" .. dtmf .. "]", "key_press")
    session:consoleLog("info", "Got DTMF digits: " .. digits .. "\n")
    return digits
end

function ivrSuccessHandler(purpose, digits)
    session:setVariable("ivr_purpose", purpose)
    session:setVariable("key_press", digits)
    execAPI_3(purpose, digits)
end

function ivrHandler(audio, dtmf, purpose)
    local invalid = "ivr/ivr-that_was_an_invalid_entry.wav"
    local digitsRange = stringy.split(dtmf, "-")
    -- session:setAutoHangup(false)
    local retries = 3
    local digits = nil

    session:execute("playback", welcomeMessage)

    digits = getDigits(audio, dtmf)
    invalid_keypress = session:getVariable("key_press_invalid")
    if isempty(digits) and not (invalid_keypress) then
        digits = getDigits(audio, dtmf)
        invalid_keypress = session:getVariable("key_press_invalid")
        if isempty(digits) and not (invalid_keypress) then
            digits = getDigits(audio, dtmf)
            invalid_keypress = session:getVariable("key_press_invalid")
            if isempty(digits) and not (invalid_keypress) then
                session:execute("hangup")
            elseif not (isempty(digits)) then
                if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
                    ivrSuccessHandler(purpose, digits)
                end
            else
                session:consoleLog("notice", "INVALID DTMF: " .. digits .. "PLAY: " .. invalid .. "\n")
                session:execute("playback", invalid)
                session:execute("hangup")
            end
        elseif not (isempty(digits)) then
            if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
                ivrSuccessHandler(purpose, digits)
            end
        else
            session:consoleLog("info", "INVALID DTMF: " .. digits .. "PLAY: " .. invalid .. "\n")
            session:execute("playback", invalid)
            digits = getDigits(audio, dtmf)
            invalid_keypress = session:getVariable("key_press_invalid")
            if isempty(digits) and not (invalid_keypress) then
                session:execute("hangup")
            elseif not (isempty(digits)) then
                if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
                    ivrSuccessHandler(purpose, digits)
                end
            else
                session:consoleLog("notice", "INVALID DTMF: " .. digits .. "PLAY: " .. invalid .. "\n")
                session:execute("playback", invalid)
                session:execute("hangup")
            end
        end
    elseif not (isempty(digits)) then
        if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
            ivrSuccessHandler(purpose, digits)
        end
    else
        session:consoleLog("info", "INVALID DTMF: " .. digits .. "PLAY: " .. invalid .. "\n")
        session:execute("playback", invalid)
        digits = getDigits(audio, dtmf)
        invalid_keypress = session:getVariable("key_press_invalid")
        if isempty(digits) and not (invalid_keypress) then
            digits = getDigits(audio, dtmf)
            invalid_keypress = session:getVariable("key_press_invalid")
            if isempty(digits) and not (invalid_keypress) then
                session:execute("hangup")
            elseif not (isempty(digits)) then
                if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
                    ivrSuccessHandler(purpose, digits)
                end
            else
                session:consoleLog("notice", "INVALID DTMF: " .. digits .. "PLAY: " .. invalid .. "\n")
                session:execute("playback", invalid)
                session:execute("hangup")
            end
        elseif not (isempty(digits)) then
            if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
                ivrSuccessHandler(purpose, digits)
            end
        else
            session:consoleLog("info", "INVALID DTMF: " .. digits .. "PLAY: " .. invalid .. "\n")
            session:execute("playback", invalid)
            digits = getDigits(audio, dtmf)
            invalid_keypress = session:getVariable("key_press_invalid")
            if isempty(digits) and not (invalid_keypress) then
                session:execute("hangup")
            elseif not (isempty(digits)) then
                if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
                    ivrSuccessHandler(purpose, digits)
                end
            else
                session:consoleLog("notice", "INVALID DTMF: " .. digits .. "PLAY: " .. invalid .. "\n")
                session:execute("playback", invalid)
                session:execute("hangup")
            end
        end
    end
end

function handleResponse(response)
    local code = response["code"]
    local dial = response["dial"]
    local voiceMessage = response["voiceMessage"]
    local keyPressValue = response["keyPressValue"]
    local purpose = response["purpose"]
    local uuid = session:getVariable("uuid")

    if code == "200" then
        console("dial handler")
        local number = string.sub(dial, -10)
        local destination = "sofia/gateway/" .. gateway .. "/91" .. number
        dialHandler(destination, uuid, number)
    elseif (code == "201") or (code == "204") then
        console("ivr handler")
        ivrHandler(voiceMessage, keyPressValue, purpose)
    else
        console("playback handler")
        session:execute("playback", voiceMessage)
        session:hangup()
    end
end

function executeUrl(url, checkRes)
    freeswitch.consoleLog("debug", url .. "\n")
    local req = http_request.new_from_uri(url)
    local req_timeout = 10
    req.headers:upsert("X-Api-Key", "e72bb2cb-4003-4e93-ba6a-abaf59a2615b")
    local headers, stream = req:go(req_timeout)

    if checkRes then
        local body, err = stream:get_body_as_string()
        if headers:get ":status" ~= "200" then
            error(body)
        end

        freeswitch.consoleLog("debug", body .. "\n")

        body = "code=" .. body
        local resbody = body:gsub("|", "&")
        local res = neturl.parseQuery(resbody)
        printTable(res)
        handleResponse(res)
    end
end

function execAPI_1()
    local caller = session:getVariable("caller_id_number")
    local called = session:getVariable("destination_number")
    local uuid = session:getVariable("uuid")
    local call_type = (called == "914466455977") and "IC" or "OC"
    local url =
        baseUrl ..
        "/" ..
            baseFile ..
                "?caller=" ..
                    caller ..
                        "&transactionid=" ..
                            uuid .. "&called=" .. called .. "&call_type=" .. call_type .. "&location=tamilnadu&pin=1"
    console(url)
    executeUrl(url, true)
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
    executeUrl(url, true)
end

-- local originated_legs = session:getVariable("originated_legs")

-- if originated_legs then
--     session:consoleLog("info", "Originated SESSION, DONT run API" .. "\n")
-- else
session:answer()
-- end

-- while (session:ready() == true and session:bridged() == false) do
-- session:execute("info", "notice")
session:setVariable("media_bug_answer_req", "true")
session:execute("record_session", "$${recordings_dir}/${uuid}.mp3")

-- if (called == "914466455977") then
--     session:execute("playback", welcomeMessage)
-- end

-- if originated_legs then
--     session:consoleLog("info", "Originated SESSION, DONT run API" .. "\n")
-- else
execAPI_1()
-- end
-- end
