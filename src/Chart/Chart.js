// @flow weak

import React, { PropTypes } from 'react';
import classNames from 'classnames';
import { createStyleSheet } from 'jss-theme-reactor';
import customPropTypes from '../utils/customPropTypes';

export const styleSheet = createStyleSheet('Chart', () => {
  return {
    row: {
      display: 'flex',
      flexDirection: 'row',
    },
    column: {
      border: '1px solid grey',
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
    },
  };
});

/**
 * A piece of material Chart.
 *
 * ```js
 * import Chart from 'material-charts/Chart';
 *
 * const Component = () => <Chart zDepth={8}>Hello World</Chart>;
 * ```
 */
export default function Chart(props, context) {
  const { className, view, trbl, children } = props;
  const classes = context.styleManager.render(styleSheet);

  return (
    <div className={classes.row}>
      <div className={classes.column}>
        <svg
          className={classNames(classes.svg, className)}
          viewBox={`0 0 ${view[0]} ${view[1]}`}
        >
          <g transform={`translate(${trbl[3]} ,${trbl[0]})`}>
            {children}
          </g>
        </svg>
      </div>
    </div>
  );
}

Chart.propTypes = {
  /**
   * The CSS class name of the root element.
   */
  children: PropTypes.node,
  /**
   * The CSS class name of the root element.
   */
  className: PropTypes.string,
  /**
   * Shadow depth, corresponds to `dp` in the spec.
   */
  trbl: PropTypes.array,
  /**
   * Set to false to disable rounded corners.
   */
  view: PropTypes.array,
};

Chart.defaultProps = {
  view: [1000, 250],
  trbl: [10, 10, 10, 10],
};

Chart.contextTypes = {
  styleManager: customPropTypes.muiRequired,
};