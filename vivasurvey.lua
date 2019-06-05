session:answer()

function isempty(s)
    return s == nil or s == ""
end

while (session:ready() == true) do
    session:setAutoHangup(false)
    session:execute("playback", "https://download.gofrugal.com/ivr/AudioFiles/main-menu15305384611.wav")
    digits = session:getDigits(1, "", 3000)

    if isempty(digits) then
        session:execute("hangup")
    elseif tonumber(digits) >= 1 and tonumber(digits) <= 5 then
        session:setVariable("csat_key_press", digits)
        session:execute("playback", "https://download.gofrugal.com/ivr/AudioFiles/star-" .. digits .. ".wav")
    else
        session:execute("hangup")
    end
end
