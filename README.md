
# hauth

Authentication module in the HFramework.
Some tests were first done and published to npmjs as package `hauth-dev`, under the scope `@horanet`, [version 0.0.4](https://www.npmjs.com/package/@horanet/hauth-dev).

The tracker for the project was set at [Github](https://github.com/naml3i/hauth-dev).

We want to avoid unpublishing package:

- the package will be blocked for 24h before republishing
- even after the 24h restriction has passed, the package of the same version number **cannot** (never) be published again on npmjs

So to avoid confusions potential conflicts:

- We'll migrate the files and folder structure and tags of the package `hauth-dev` and continue to the packaging of this node package, named as `hauth`

- `hauth` will be published under `@horanet` just like `hauth-dev` (remember to change the `dependencies` and `require` lines in the code accordingly).

- versioning will follow [sematic version](https://semver.org/), and continue from the change to 0.0.4 (i.e. any next publishing will start from 0.0.5). This is done conviniently by the package `standard-version`. It helps change the CHANGELOG and automatically change the `package.json` file each publication.
