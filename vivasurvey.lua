local http_request = require "http.request"

session:answer()

function isempty(s)
    return s == nil or s == ""
end

function executeUrl(url)
    freeswitch.consoleLog("debug", url .. "\n")
    local req = http_request.new_from_uri(url)
    local req_timeout = 10
    req.headers:upsert("X-Api-Key", "e72bb2cb-4003-4e93-ba6a-abaf59a2615b")
    local headers, stream = req:go(req_timeout)
    freeswitch.consoleLog("debug", body .. "\n")
end

while (session:ready() == true) do
    session:setAutoHangup(false)
    session:execute("playback", "https://download.gofrugal.com/ivr/AudioFiles/main-menu15305384611.wav")
    digits = session:getDigits(1, "", 3000)

    if isempty(digits) then
        session:execute("hangup")
    elseif tonumber(digits) >= 1 and tonumber(digits) <= 5 then
        local uuid = session:getVariable("uuid")
        local url =
            "https://labtest.gofrugal.com/call_center/ismile/dsl_submit.php?cloud_call=1&transactionid=" ..
            uuid .. "&keypress=" .. digits .. "&purpose=ticket_rating"
        -- session:setVariable("csat_key_press", digits)
        session:execute("playback", "https://download.gofrugal.com/ivr/AudioFiles/star-" .. digits .. ".wav")
        executeUrl(url)
        session:execute("hangup")
    else
        session:execute("hangup")
    end
end
