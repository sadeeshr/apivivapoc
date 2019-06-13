uuid = argv[1]
type = argv[2]
name = argv[3]

api = freeswitch.API()

if type == "setTime" then
    time = api:getTime()
    command = "uuid_setvar " .. uuid .. " " .. name .. " " .. time
    freeswitch.consoleLog("notice", "SET AGENT EVENT TIME: " .. name .. " " .. time .. "\n")
    api:executeString(command)
end
