uuid = argv[1]
type = argv[2]
name = argv[3]

api = freeswitch.API()

if type == "setTime" then
    time = api:getTime()
    command = "uuid_setvar " .. uuid .. " agent_answered_time " .. time
    freeswitch.consoleLog("notice", "AGENT ANSWERED TIME: " .. time .. "\n")
    api:executeString(command)
end
