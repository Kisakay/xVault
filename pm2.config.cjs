module.exports = {
    name: "xVault",
    script: "bun",
    args: "run start",
    env: {
        PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`,
        NODE_ENV: 'production'
    },
};