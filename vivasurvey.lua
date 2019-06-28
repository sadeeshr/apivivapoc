local http_request = require "http.request"
local stringy = require "stringy"

session:answer()

function isempty(s)
    return s == nil or s == ""
end

function executeUrl(url)
    freeswitch.consoleLog("notice", url .. "\n")
    local req = http_request.new_from_uri(url)
    local req_timeout = 10
    req.headers:upsert("X-Api-Key", "e72bb2cb-4003-4e93-ba6a-abaf59a2615b")
    local headers, stream = req:go(req_timeout)
    -- freeswitch.consoleLog("debug", body .. "\n")
end

function getDigits(audio, dtmf)
    digits = session:playAndGetDigits(1, 1, 1, 3000, "", audio, "", "[" .. dtmf .. "]", "survey_key_press")
    session:consoleLog("notice", "Got DTMF digits: " .. digits .. "\n")
    return digits
end

function ivrSuccessHandler(digits)
    local uuid = session:getVariable("uuid")
    local url =
        "https://labtest.gofrugal.com/ismile/dsl_submit.php?cloud_call=1&transactionid=" ..
        uuid .. "&keypress=" .. digits .. "&purpose=ticket_rating"
    -- session:setVariable("csat_key_press", digits)
    session:execute("playback", "https://download.gofrugal.com/ivr/AudioFiles/star-" .. digits .. ".wav")
    session:execute("hangup")
    -- freeswitch.msleep(5000)
    session:execute("sleep", "5000")
    executeUrl(url)
end

function ivrHandler(audio, dtmf)
    local invalid = "ivr/ivr-that_was_an_invalid_entry.wav"
    local digitsRange = stringy.split(dtmf, "-")
    -- session:setAutoHangup(false)
    local retries = 3
    local digits = nil

    digits = getDigits(audio, dtmf)
    invalid_keypress = session:getVariable("survey_key_press_invalid")
    if isempty(digits) and not (invalid_keypress) then
        digits = getDigits(audio, dtmf)
        invalid_keypress = session:getVariable("survey_key_press_invalid")
        if isempty(digits) and not (invalid_keypress) then
            digits = getDigits(audio, dtmf)
            invalid_keypress = session:getVariable("survey_key_press_invalid")
            if isempty(digits) and not (invalid_keypress) then
                session:execute("hangup")
            elseif not (isempty(digits)) then
                if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
                    ivrSuccessHandler(digits)
                end
            else
                session:consoleLog("notice", "INVALID DTMF: " .. digits .. "PLAY: " .. invalid .. "\n")
                session:execute("playback", invalid)
                session:execute("hangup")
            end
        elseif not (isempty(digits)) then
            if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
                ivrSuccessHandler(digits)
            end
        else
            session:consoleLog("notice", "INVALID DTMF: " .. digits .. "PLAY: " .. invalid .. "\n")
            session:execute("playback", invalid)
            digits = getDigits(audio, dtmf)
            invalid_keypress = session:getVariable("survey_key_press_invalid")
            if isempty(digits) and not (invalid_keypress) then
                session:execute("hangup")
            elseif not (isempty(digits)) then
                if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
                    ivrSuccessHandler(digits)
                end
            else
                session:consoleLog("notice", "INVALID DTMF: " .. digits .. "PLAY: " .. invalid .. "\n")
                session:execute("playback", invalid)
                session:execute("hangup")
            end
        end
    elseif not (isempty(digits)) then
        if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
            ivrSuccessHandler(digits)
        end
    else
        session:consoleLog("notice", "INVALID DTMF: " .. digits .. "PLAY: " .. invalid .. "\n")
        session:execute("playback", invalid)
        digits = getDigits(audio, dtmf)
        invalid_keypress = session:getVariable("survey_key_press_invalid")
        if isempty(digits) and not (invalid_keypress) then
            digits = getDigits(audio, dtmf)
            invalid_keypress = session:getVariable("survey_key_press_invalid")
            if isempty(digits) and not (invalid_keypress) then
                session:execute("hangup")
            elseif not (isempty(digits)) then
                if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
                    ivrSuccessHandler(digits)
                end
            else
                session:consoleLog("notice", "INVALID DTMF: " .. digits .. "PLAY: " .. invalid .. "\n")
                session:execute("playback", invalid)
                session:execute("hangup")
            end
        elseif not (isempty(digits)) then
            if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
                ivrSuccessHandler(digits)
            end
        else
            session:consoleLog("notice", "INVALID DTMF: " .. digits .. "PLAY: " .. invalid .. "\n")
            session:execute("playback", invalid)
            digits = getDigits(audio, dtmf)
            invalid_keypress = session:getVariable("survey_key_press_invalid")
            if isempty(digits) and not (invalid_keypress) then
                session:execute("hangup")
            elseif not (isempty(digits)) then
                if tonumber(digits) >= tonumber(digitsRange[1]) and tonumber(digits) <= tonumber(digitsRange[2]) then
                    ivrSuccessHandler(digits)
                end
            else
                session:consoleLog("notice", "INVALID DTMF: " .. digits .. "PLAY: " .. invalid .. "\n")
                session:execute("playback", invalid)
                session:execute("hangup")
            end
        end
    end
end

while (session:ready() == true) do
    local audio = "https://download.gofrugal.com/ivr/AudioFiles/main-menu15305384611.wav"
    local keypress = "1-5"
    session:setAutoHangup(false)
    session:setVariable("hangup_after_bridge", "false")
    session:setVariable("continue_on_fail", "true")
    ivrHandler(audio, keypress)
end

-- session:setVariable("playback_terminators", "any")
-- session:execute("playback", "https://download.gofrugal.com/ivr/AudioFiles/main-menu15305384611.wav")
-- digits = session:getDigits(1, "", 3000)
-- digits =
--     session:playAndGetDigits(
--     1,
--     1,
--     1,
--     3000,
--     "",
--     "https://download.gofrugal.com/ivr/AudioFiles/main-menu15305384611.wav",
--     "",
--     "[1-5]",
--     ""
-- )

-- if isempty(digits) then
--     session:execute("hangup")
-- elseif tonumber(digits) >= 1 and tonumber(digits) <= 5 then
--     local uuid = session:getVariable("uuid")
--     local url =
--         "https://labtest.gofrugal.com/call_center/ismile/dsl_submit.php?cloud_call=1&transactionid=" ..
--         uuid .. "&keypress=" .. digits .. "&purpose=ticket_rating"
--     -- session:setVariable("csat_key_press", digits)
--     executeUrl(url)
--     session:execute("playback", "https://download.gofrugal.com/ivr/AudioFiles/star-" .. digits .. ".wav")
--     session:execute("hangup")
-- else
--     session:execute("hangup")
-- end
