// @flow weak

import { EXAMPLE_STORE_KEY } from './modules/constants';

export default (store, injectReducer) => ({
  nav: true,
  path: `/examples/bar-charts/${EXAMPLE_STORE_KEY}`,
  title: 'States By Age',
  getComponent(nextState, cb) {
    require.ensure([], (require) => {
      const Example = require('./example').default;
      const reducer = require('./modules').default;

      injectReducer(store, { key: EXAMPLE_STORE_KEY, reducer });
      cb(null, Example);
    });
  },
});
