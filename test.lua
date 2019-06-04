url = require "net.url"
stringy = require "stringy"

local res =
    "201|voiceMessage=https://download.gofrugal.com/ivr/AudioFiles/201-I.wav|keyPress=true|keyPressValue=1-3|purpose=unknown_call_transfer"

res = "code=" .. res

local result = res:gsub("|", "&")
-- print(result)

local query = url.parseQuery(result)
print(query["code"])
print(query["voiceMessage"])
print(query["keyPress"])
print(query["keyPressValue"])
print(query["purpose"])
keyrange = stringy.split(query["keyPressValue"], "-")
print("start range: " .. keyrange[1] .."  end range: " .. keyrange[2])
print("key type: " .. type(keyrange[1]))