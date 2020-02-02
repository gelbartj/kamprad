import React from 'react';
import './Switch.css'

const Switch = ({ checked, onChange, onColor, height, width }) => {
  return (
    <>
      <input
        checked={checked}
        onChange={onChange}
        className="react-switch-checkbox"
        id={`react-switch-new`}
        type="checkbox"
      />
      <label
        className={"react-switch-label" + (checked ? " checked" : "")}
        htmlFor={`react-switch-new`}
      >
        <span className={`react-switch-button`} />
      </label>
    </>
  );
};

export default Switch;