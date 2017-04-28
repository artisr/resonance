// @flow weak
/* eslint react/prop-types: "off" */

import React, { Component } from 'react';
import now from 'performance-now';
import RAF from 'raf';
import { interpolate } from 'd3-interpolate';
import * as Easing from 'd3-ease';
import { dedupe, mergeItems } from './helpers';

const msPerFrame = 1000 / 60;

const defaults = {
  data: [],
  ignore: [],
  duration: 500,
  easing: 'easeCubicOut',
  enter: () => null,
  leave: () => null,
  onRest: () => null,
  stagger: null,
  flexDuration: false,
};

export default class Transition extends Component {
  static defaultProps = defaults

  constructor() {
    super();
    this.state = {
      items: [],
    };
  }

  componentWillMount() {
    this.unmounting = false;
    this.animationID = null;
    this.lastRenderTime = 0;
  }

  componentDidMount() {
    this.pivot(this.props);
    this.ranFirst = true;
  }

  componentWillReceiveProps(props) {
    this.pivot(props);
  }

  componentWillUnmount() {
    this.unmounting = true;
    if (this.animationID != null) {
      RAF.cancel(this.animationID);
      this.animationID = null;
    }
  }

  pivot(props) {
    const {
      getKey,
      data,
      update,
      enter,
      leave,
      easing,
      ignore,
    } = props;

    // Detect if we need to animate
    const noChanges = this.props.data === data;

    // If this is the first time, animate regardless
    if (this.ranFirst && noChanges) {
      return;
    }

    // Update the easing function
    this.easer = typeof easing === 'function' ? easing : Easing[easing] || Easing[defaults.easing];

    // Get the current items from the state (which is the visual
    // representation of our items)
    const currentItems = this.state.items.map((d) => ({
      ...d,
      entering: false, // Be sure to reset their status
      leaving: false,
    }));

    // Get the new items with their keys and data
    const newItems = data.map((d, i) => {
      return {
        key: getKey(d, i),
        data: d,
        progress: 0,
      };
    });

    // Find items that are entering
    newItems.filter(
      (destItem) => !currentItems.find(
        (originItem) => originItem.key === destItem.key,
      ),
    ).forEach((item) => {
      item.entering = true; // eslint-disable-line no-param-reassign
    });

    // Find items that are leaving
    currentItems.filter(
      (originItem) => !newItems.find(
        (destItem) => destItem.key === originItem.key,
      ),
    ).forEach((item) => {
      item.entering = true; // eslint-disable-line no-param-reassign
    });

    // Used to make all the interpolators from origin to destination states
    const makeInterpolators = (originState, destState) => {
      // Make sure we interpolate new and old keys
      const allKeys = dedupe(Object.keys(originState), Object.keys(destState));
      const interpolators = {};

      allKeys.forEach((key) => {
        if (ignore.indexOf(key) > -1) {
          interpolators[key] = null;
          return;
        }
        if (originState[key] === destState[key]) {
          interpolators[key] = null;
          return;
        }
        interpolators[key] = interpolate(originState[key], destState[key]);
      });

      return interpolators;
    };

    // Merge all of the items together and
    // give each item it's new origin/destination states
    // with corresponding interpolators
    this.items = mergeItems(currentItems, newItems).map((item) => {
      // Reset the progress on the item
      const progress = 0;

      let originState;
      let destState;
      let interpolators;

      if (item.leaving) {
        destState = leave(item.data, item.key);
        originState = item.state;
        interpolators = makeInterpolators(originState, destState);
      } else if (item.entering) {
        destState = item.state || update(item.data, item.key);
        originState = enter(item.data, item.key) || destState;
        interpolators = makeInterpolators(originState, destState);
      } else {
        const previous = currentItems.find((d) => d.key === item.key);
        destState = update(item.data, item.key);
        originState = previous.state;
        interpolators = makeInterpolators(originState, destState);
      }

      return {
        ...item,
        progress,
        originState,
        destState,
        interpolators,
      };
    });

    // Reset the startTime and lastRenderTime
    this.startTime = now();

    if (!this.wasAnimating) {
      this.lastRenderTime = this.startTime;
    }

    // Be sure to render the origin frame
    this.renderProgress();

    // Animate if needed
    this.animate();
  }

  animate() {
    // If we're unmounting, bail out.
    if (this.unmounting) {
      return;
    }

    // If we're already animated, bail out.
    if (this.animationID) {
      return;
    }

    const {
      onRest,
      duration,
      stagger,
      staggerGroups,
      flexDuration,
    } = this.props;

    this.animationID = RAF(() => {
      // Double check that we are still mounted, since RAF can perform
      // asyncronously sometimes
      if (this.unmounting) {
        return;
      }

      const needsAnimation = this.items.reduce((d, item) => {
        return d || item.progress < 1;
      }, false);

      // If the animation is complete, tie up any loose ends...
      if (!needsAnimation) {
        if (this.wasAnimating) {
          onRest();
        }

        this.animationID = null;
        this.wasAnimating = false;

        return;
      }

      // It's time to animate!
      this.wasAnimating = true;

      // Keep track of time
      const currentTime = now();
      const timeSinceLastFrame = currentTime - this.lastRenderTime;

      // Are we using flexDuration?
      if (flexDuration) {
        // Add however many milliseconds behind we are to the startTime to offset
        // any dropped frames
        this.startTime += Math.max(Math.floor(timeSinceLastFrame - msPerFrame), 0);
      }

      this.items = this.items.map((item, i) => {
        let progress;

        // For staggering time based animations, we just need the index
        let staggerIndex = i + 1;
        // But if we are staggering by group, we will instead need the type index of the item
        if (stagger && staggerGroups) {
          staggerIndex = 0;

          for (let ii = 0; ii < i; ii++) {
            const staggerItem = this.items[ii];
            if (
              staggerItem.entering === item.entering &&
              staggerItem.exiting === item.exiting
            ) {
              staggerIndex++;
            }
          }
        }

        // Set the progress
        if (stagger) {
          // If its staggered, we need base the progress off of
          // the staggered time, instead of the currentTime
          const staggerOffset = stagger * staggerIndex;
          const adjustedCurrentTime = currentTime - staggerOffset;
          progress = (adjustedCurrentTime - this.startTime) / duration;
        } else {
          // or just calculate normal time based progress
          progress = (currentTime - this.startTime) / duration;
        }

        // Make sure progress is between 0 and 1
        progress = Math.max(Math.min(progress, 1), 0);

        return {
          ...item,
          progress,
        };
      });

      // Render with the progress
      this.renderProgress();

      // Update the lastRenderTime
      this.lastRenderTime = currentTime;

      // Mark the frame as done
      this.animationID = null;

      this.animate();
    });
  }

  renderProgress() {
    const items = this.items
      .filter((item) => // Remove the items that have exited
        (
          !item.leaving ||
          item.entering
        ) || item.progress !== 1,
      )
      .map((item) => {
        const state = {};
        const allKeys = dedupe(Object.keys(item.originState), Object.keys(item.destState));

        allKeys.forEach((key) => {
          if (!item.progress) {
            // If at absolute 0, draw the origin state
            state[key] = item.originState[key];
          } else if (!item.interpolators[key]) {
            // If ignored, skip right to the value
            state[key] = item.destState[key];
          } else {
            // Otherwise, interpolate with the progress
            state[key] = item.interpolators[key](this.easer(item.progress));
          }
        });

        return {
          ...item,
          state,
        };
      });

    this.setState({ items });
  }

  render() {
    const renderedChildren = this.props.children(this.state.items);
    return renderedChildren && React.Children.only(renderedChildren);
  }
}

Transition.defaults = defaults;
