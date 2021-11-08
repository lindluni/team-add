## Team Add

A GitHub Action for ensuring org members are added to a specific set of teams.

### Example Usage

```yaml
name: Add Team Members
on:
  schedule:
    - '15 3 * * *'
jobs:
  add-users:
    name: Add Users
    runs-on: ubuntu-latest
    steps:
      - name: Add Users
        uses: lindluni/team-add@1.0.0
        with:
          teams: team1,team2,team3
          token: ${{ secrets.GITHUB_ADMIN_PAT }}

```
