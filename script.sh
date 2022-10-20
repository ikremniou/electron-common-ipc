target_branch="dev"
bump_message="\"chore(release): update package versions\""

if [ $target_branch == "dev" ]; then
    npx lerna version prerelease --preid dev --no-private --yes --force-publish -m "$bump_message"
else
    npx lerna version minor --no-private --yes --force-publish -m "$bump_message"
fi

npx lerna publish from-git --yes