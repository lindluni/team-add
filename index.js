const core = require('@actions/core')
const {Octokit} = require("@octokit/rest")
const {retry} = require("@octokit/plugin-retry");
const {throttling} = require("@octokit/plugin-throttling");

(async function main() {
    const input = await parseInput()
    const client = await newClient(input.token)
    const orgMembers = await getOrgMembers(client, input.org)
    for (const team of input.teams) {
        const teamMembers = await getTeamMembers(client, input.org, team)
        for (const member of orgMembers) {
            if (!teamMembers.includes(member)) {
                await addUserToTeam(client, member, input.org, team.trim())
            }
        }
    }
})()

async function newClient(token) {
    try {
        core.info(`Creating new GitHub client`)
        const _Octokit = Octokit.plugin(retry, throttling)
        return new _Octokit({
            auth: token,
            throttle: {
                onRateLimit: (retryAfter, options, octokit) => {
                    octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
                    if (options.request.retryCount === 0) {
                        octokit.log.info(`Retrying after ${retryAfter} seconds!`);
                        return true;
                    }
                },
                onAbuseLimit: (retryAfter, options, octokit) => {
                    octokit.log.warn(`Abuse detected for request ${options.method} ${options.url}`);
                },
            }

        })
    } catch (e) {
        core.setFailed(`Failed creating client: ${e.message}`)
        process.exit(1)
    }
}

async function parseInput() {
    const input = {}
    try {
        core.info(`Parsing Actions input`)
        input.org = core.getInput('ORG', {required: true, trimWhitespace: true}).trim()
        input.teams = core.getInput('TEAMS', {required: true, trimWhitespace: true}).trim().split(',')
        input.token = core.getInput('TOKEN', {required: true, trimWhitespace: true}).trim()
        return input
    } catch (error) {
        core.setFailed(`Failed retrieving token: ${error.message}`)
        process.exit(1)
    }
}

async function getOrgMembers(client, org) {
    try {
        core.info(`Retrieving all org members for org ${org}`)
        const response = await client.paginate(client.orgs.listMembers, {
            org: org,
            per_page: 100
        })
        return response.map(member => member.login)
    } catch (e) {
        core.setFailed(`Failed getting org members: ${e.message}`)
        process.exit(1)
    }
}

async function getTeamMembers(client, org, team) {
    try {
        core.info(`Retrieving team membership for team ${team}`)
        const response = await client.paginate(client.teams.listMembersInOrg, {
            org: org,
            team_slug: team,
            per_page: 100
        })
        return response.map(member => member.login)
    } catch (e) {
        core.setFailed(`Failed getting team members: ${e.message}`)
        process.exit(1)
    }
}

async function addUserToTeam(client, username, org, team) {
    try {
        core.info(`Adding user ${username} to team ${team}`)
        await client.teams.addOrUpdateMembershipForUserInOrg({
            org: org,
            team_slug: team,
            username: username,
            role: 'member'
        })
    } catch (e) {
        core.error(`Failed adding user ${username} to team ${team}: ${e.message}`)
        core.setFailed(`Failed adding users to team`)
    }
}
