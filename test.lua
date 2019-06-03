url = require "net.url"
stringy = require "stringy"

local res =
    "201|voiceMessage=https://download.gofrugal.com/ivr/AudioFiles/201-I.wa201|voiceMessage=https://download.gofrugal.com/ivr/AudioFiles/201-I.wav|keyPress=true|keyPressValue=1-3|purpose=unknown_call_transfer"

local result = res:gsub("|", "&")
-- print(result)

local query = url.parseQuery(result)
print(query["keyPress"])
print(query["keyPressValue"])
print(query["purpose"])
print(query["voiceMessage"])
