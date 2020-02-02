import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import Switch from './switch-component/Switch'
import firebase from 'firebase/app';
import * as firebaseui from 'firebaseui';

import tos from './tos';
import pp from './pp';

import firebaseConfig from './firebaseConfig';

require('firebase/firestore');  

var defaultProj = firebase.initializeApp(firebaseConfig);

let db = defaultProj.firestore(); // or can just use firebase.firestore()

db.enablePersistence()
  .catch(function(err) {
      if (err.code === 'failed-precondition') {
          console.log("Multiple tabs open, persistence can only be enabled in one tab at a time.")
          // ...
      } else if (err.code === 'unimplemented') {
          console.log("The current browser does not support all of the features required to enable persistence.")
          // ...
      }
  });
// Subsequent queries will use persistence, if it was enabled successfully

const updateDB = (successListArg,failListArg,isWorkingArg,firebaseAuth) => {
    if (firebaseAuth.currentUser) {
        let userId = firebaseAuth.currentUser.uid;
        let docRef = db.collection('users').doc(userId);

        if (!successListArg && !failListArg) {
            docRef.get().then(doc => {
                if (!doc.exists) {
                console.log('No such document!');
                } else {
                    docRef.set({
                        successList: doc.data().successList,
                        failList: doc.data().failList,
                        latestIsWorking: isWorkingArg,
                        lastUpdated: new Date().getTime(),
                    });
                }
            })
            .catch(err => {
                console.log('Error getting document', err);
            });
        }
        else {
            docRef.set({
                successList: successListArg,
                failList: failListArg,
                latestIsWorking: isWorkingArg,
                lastUpdated: new Date().getTime(),
            })
            .catch(err => {
                console.log('Error updating document', err);
            });
        }
        return true;
    }
    else {
        return false;
    }

}

/* ////////// FIREBASE UI CONFIG ////////////// */
var showPolicy = (policy) => {
    let policyObj = document.getElementById(policy);
    if (policyObj.className === policy) document.getElementById(policy).className = policy + " show";
    else document.getElementById(policy).className = policy;
}
var hidePolicy = (policy) => {
    let policyObj = document.getElementById(policy);
    if (policyObj.className === (policy + " show")) document.getElementById(policy).className = policy;
}
var uiConfig = {
    signInSuccessUrl: '/',
    signInOptions: [
        // Leave the lines as is for the providers you want to offer your users.
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.FacebookAuthProvider.PROVIDER_ID,
    ],
    // tosUrl and privacyPolicyUrl accept either url string or a callback
    // function.
    // Terms of service url/callback.
    //tosUrl: '/tos',
    tosUrl: function () {
        showPolicy('tos');
        hidePolicy('pp');
    },
    // Privacy policy url/callback.
    privacyPolicyUrl: function () {
        showPolicy('pp');
        hidePolicy('tos');
    },
    callbacks: {
        // Avoid redirects after sign-in.
        signInSuccessWithAuthResult: () => false
    }
};



let LoginComponent = ({ uiConfig, firebaseAuth, isSignedIn, setIsSignedIn, setCurrUserState }) => {
    let userRef = useRef();

    useEffect(() => {
        let unregisterAuthObserver = firebaseAuth.onAuthStateChanged(
            (user) => {
                setIsSignedIn(!!user)

                if (user) {
                    userRef.current = user;
                    setCurrUserState(user);

                    let docRef = db.collection('users').doc(user.uid);
                    docRef.get().then(doc => {
                        if (!doc.exists) { // initialize DB from localstorage for first-time user
                            docRef.set({
                                successList: localStorage.getItem('successList'),
                                failList: localStorage.getItem('failList'),
                                latestIsWorking: localStorage.getItem('isWorking'),
                                lastUpdated: new Date().getTime(),
                            });
                        } else {
                            // do nothing
                        }
                        })
                        .catch(err => {
                        console.log('Error getting document', err);
                        });
                    
                }
            }
        );
        return () => {
            unregisterAuthObserver();
        }
    }, [isSignedIn, setIsSignedIn, firebaseAuth, setCurrUserState]);

    // Initialize the FirebaseUI Widget using Firebase.
    let ui = firebaseui.auth.AuthUI.getInstance();

    if (!ui) {
        ui = new firebaseui.auth.AuthUI(firebaseAuth);
    }
    // The start method will wait until the DOM is loaded.

    const loginDiv = useCallback(node => {
        if (node !== null) {
            ui.start(node, uiConfig);
        }
    }, [ui,uiConfig]);

    const handleSignOut = () => {
        firebaseAuth.signOut().then(function() {
            console.log("Sign out successful");
            setIsSignedIn(false);
            setTimeout(window.location.reload(),1500);
          }).catch(function(error) {
            console.log("Sign out error: ",error);
          });
        
    }

    if (isSignedIn) {
        return (
            <div className="signedIn">
            <p>Signed in as {firebaseAuth.currentUser ? firebaseAuth.currentUser.displayName : 
                (userRef.current ? userRef.current.displayName : "...")}</p>
            <button className="signOut" onClick={handleSignOut}>Sign out</button>
            </div>
        );
    }
    return (
        <div className="signIn">
            <p>Want to save your results and sync across devices? Please log in or sign up using the links below.</p>
            <div ref={loginDiv} />
        </div>
    );
}

/*
function hoursRange(size, startAt = 0) {
 let range = [(startAt === 0 ? 23 : startAt - 1),startAt];
 for (let i=0; i < size; i++) {
 if (startAt !== 24) { startAt += 1; }
 else { startAt = 0; }
 range.push(startAt);
 }
 return range;
}
*/

const _MS_IN_HR = 1000 * 60 * 60;

function checkTime(date) {
    const now = new Date();
    let updMinute = Math.floor(now.getMinutes() / 10) * 10;

    now.setHours(now.getHours(), updMinute, 0, 0);

    if (date.getTime() === now.getTime()) {
        return 0;
    }
    if (date.getTime() < now.getTime()) {
        return -1;
    }
    return 1;
}

function getCompPct() {
    const now = new Date();
    const minutes = now.getMinutes() % 10;
    const seconds = now.getSeconds();

    let compPct = (minutes * 60 + seconds) / (10 * 60);
    return compPct;
}


function useInterval(callback, delay) {
    const savedCallback = useRef();

    // Remember the latest callback.
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    // Set up the interval.
    useEffect(() => {
        function tick() {
            savedCallback.current();
        }
        if (delay !== null) {
            let itvl = setInterval(tick, delay);
            return () => clearInterval(itvl);
        }
    }, [delay]);
}

/* //////////////// MINUTEBLOCK component //////////////// */

let MinuteBlock = (props) => {
    let newClassName = "minuteBlock";
    let status = props.getStatus(props.date);
    if (props.status === 0) { newClassName += " current"; }
    else if (props.status === 1) { newClassName += " future"; }
    else {
        if (props.justUpdated === props.date.getTime()) {
            newClassName += " justUpdated";
            if (status === "success") newClassName += " success";
            else { newClassName += " fail"; }
        }
    }

    return (
        <td className="minuteCell" onClick={(e) => props.handleClick(props.date)}>
            <div className={newClassName} >
                <div className={"progress " + ((props.status === 0) ? (props.isWorking ? "success" : "fail") : status)}
                    style={{ width: props.compPct.toString() * 100 + "%" }} />

            </div></td>
    );
}

/* /////////////// MINUTEBLOCKS component //////////////////// */

let MinuteBlocks = (props) => [...Array(6).keys()].map(minute => {
    let newCompPct = 0;
    let newDate = new Date(props.date.getTime()); // clone date
    newDate.setHours(props.date.getHours(), minute * 10, 0, 0);

    let checkedTime = checkTime(newDate);

    if (checkedTime === -1) { newCompPct = 1; }
    else if (checkedTime === 0) {
        newCompPct = props.compPct + 0;
    }

    return (<MinuteBlock key={newDate.getTime()} minute={minute} hour={props.hour}
        status={checkedTime} date={newDate} handleClick={props.handleClick}
        getStatus={props.getStatus} compPct={newCompPct} isWorking={props.isWorking}
        justUpdated={props.justUpdated} />);

})

let parseBool = (val) => {
    return val === true || val === "true";
}

const useStateWithLocalStorage = (localStorageKey, startVal, type, isSignedIn, currUserState) => {
        let stateInitialVal = localStorage.getItem(localStorageKey);

        // Local storage is always a string, so need these functions to convert back
        if (stateInitialVal) {
            if (typeof startVal === "number") {
                stateInitialVal = parseInt(stateInitialVal);
            }
            else if (typeof startVal === "boolean") {
                stateInitialVal = parseBool(stateInitialVal);
            }
            else if (Array.isArray(startVal)) {
                stateInitialVal = stateInitialVal.split(',');
                if (type === "number") {
                    stateInitialVal = stateInitialVal.map((val) => parseInt(val));
                }
            }
            else if (startVal instanceof Date) {
                stateInitialVal = new Date(stateInitialVal);
            }
        }
        else { stateInitialVal = startVal; }
        const [value, setValue] = useState(stateInitialVal);

        useEffect(() => {
            if (!isSignedIn && !currUserState) { 
                        localStorage.setItem(localStorageKey, value);
            }
        }, [value,isSignedIn,localStorageKey,currUserState]);

    return [value, setValue];
};

/* /////////////// HOURBLOCKS component ////////////// */

let HourBlocks = (props) => {
    const [successList, setSuccessList] = useStateWithLocalStorage('successList', [], "number",props.isSignedIn,props.currUserState);
    const [failList, setFailList] = useStateWithLocalStorage('failList', [], "number",props.isSignedIn,props.currUserState);
    const [compPct, setCompPct] = useState(getCompPct());

    let firebaseProp = props.firebaseAuth; // defining here to avoid useEffect warning
    let setIsWorkingProp = props.setIsWorking; // defining here to avoid useEffect warning

    useEffect(()=>{
        if (firebaseProp) {
            let unregisterAuthObserver = firebaseProp.onAuthStateChanged(
                (user) => {
                    if (user) {
                        let userId = firebaseProp.currentUser.uid;
                        let doc = db.collection('users').doc(userId);

                        doc.onSnapshot({ includeMetadataChanges: true },docSnapshot => {
                            setSuccessList(docSnapshot.data().successList);
                            setFailList(docSnapshot.data().failList);
                            setIsWorkingProp(docSnapshot.data().latestIsWorking);

                            }, err => {
                                console.log(`Encountered error: ${err}`);
                            }
                            
                        );
                    }
                }
            );
            return () => {
                unregisterAuthObserver();
            }
        }
    },[firebaseProp,setFailList,setIsWorkingProp,setSuccessList]);

    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    let currHour = new Date(now.getTime());
    currHour.setHours(currHour.getHours(), 0, 0, 0);

    let getCurrent = () => {
        let newNow = new Date(); // have to create a new variable. Passing the "now" variable from above results in 10-second delay.
        newNow.setHours(newNow.getHours(), Math.floor(newNow.getMinutes() / 10) * 10, 0, 0);
        return newNow.getTime();
    }

    const [currentBlock, setCurrentBlock] = useState(getCurrent());
    const [justUpdated, setJustUpdated] = useState(0);

    let updateStartDate = (change) => {
        let newStartDate = new Date(props.startDate.getTime()); // clone
        newStartDate.setHours(props.startDate.getHours() + change);
        props.setStartDate(newStartDate);
    }

    let currHourShown = (nowArg) => {
        let nowReturn = now;
        if (nowArg) { nowReturn = nowArg; }
        return (nowReturn.getTime() >= props.startDate.getTime()) && (nowReturn.getTime() <= new Date(props.startDate.getTime() + props.hrsToShow * _MS_IN_HR).getTime());
    }

    let updateBlock = () => {
        let newBlock = getCurrent();
        if (newBlock !== currentBlock) {
            if (props.isWorking) {
                currSuccess.push(currentBlock);
                setSuccessList(currSuccess);
            }
            else {
                currFail.push(currentBlock);
                setFailList(currFail);
            }
            setJustUpdated(currentBlock);
            setCurrentBlock(newBlock);
            if (!currHourShown(new Date())) {
                updateStartDate(1);
            }
            if (props.currUserState) {
                let updated = updateDB(currSuccess,currFail,props.isWorking,props.firebaseAuth);
                if (!updated) { props.setCurrUserState(null); }
            }
        }
        else {
            setJustUpdated(0);
        }

        setCompPct(getCompPct());
    }
    useInterval(() => {
        updateBlock();
    }, 10000);


    let currSuccess = [...successList];

    let currFail = [...failList];

    function handleClick(date) {
        let cellId = date.getTime();

        let checkedTime = checkTime(date);

        let currIsWorking = props.isWorking;

        // Don't allow marking future blocks or those more than 3 hrs past as complete
        if (checkedTime === 1 || cellId < new Date().getTime() - _MS_IN_HR * 3) {
            return;
        }

        let cellStatus = '';

        if (currSuccess.indexOf(cellId) !== -1) {
            cellStatus = 'success';
        }

        if (currFail.indexOf(cellId) !== -1) {
            cellStatus = 'fail';
        }

        let newStatus = '';

        if (cellStatus === 'success') {
            newStatus = 'fail';
            if (checkedTime === 0) {
                props.setIsWorking(!props.isWorking);
                currIsWorking = !props.isWorking;
            }
            else {
                currFail.push(cellId);
                currSuccess.splice(currSuccess.indexOf(cellId), 1);
            }
        }

        else if (cellStatus === 'fail') {
            newStatus = '';
            if (checkedTime !== 0) {
                currFail.splice(currFail.indexOf(cellId), 1);
            }
        }

        else {
            newStatus = 'success';
            if (checkedTime === 0) {
                props.setIsWorking(!props.isWorking);
                currIsWorking = !props.isWorking;
            }
            else {
                currSuccess.push(cellId);
            }
        }

        setSuccessList(currSuccess);
        setFailList(currFail);

        
        if (props.currUserState) {
            let updated = updateDB(currSuccess,currFail,currIsWorking,props.firebaseAuth);
            if (!updated) props.setCurrUserState(null);
        }

        return newStatus;
    }

    function getStatus(date) {
        let cellId = date.getTime();
        if (successList.indexOf(cellId) !== -1) {
            return 'success';
        }

        if (failList.indexOf(cellId) !== -1) {
            return 'fail';
        }

        return '';
    }

    function hourEffCount(hour) {
        return currSuccess.filter(cellId => (new Date(cellId).getHours() === hour ? true : false)).length;
    }

    function dayEffCount(day) {
        return currSuccess.filter(cellId => (new Date(cellId).getDate() === day.getDate() ? true : false)).length;
    }

    function dayFailCount(day) {
        return currFail.filter(cellId => (new Date(cellId).getDate() === day.getDate() ? true : false)).length;
    }

    /* Uncomment when ready to launch Statistics page ////////
    let longestStreak = () => {
        let highestCount = 0;
        let currentCount = 0;
        let currentStreakStart = 0;
        let highestStreakStart = 0;
        let sortedList = successList.sort();

        for (let i = 1; i < sortedList.length; i++) {
            let currBlock = sortedList[i];
            let prevBlock = sortedList[i - 1];
            if (currBlock === prevBlock + _MS_IN_MIN * 10) {
                currentCount += 1;
                if (currentCount === 1) {
                    currentStreakStart = i - 1;
                }
                if (currentCount > highestCount) {
                    highestCount = currentCount;
                    highestStreakStart = currentStreakStart;
                }
            }
            else {
                if (currBlock !== prevBlock) { // only reset count if not a duplicate. Shouldn't be an issue outside of dev but can't hurt
                    currentCount = 0;
                }
            }

        }
        return ("Longest streak is " + highestCount.toString() + " from " + new Date(sortedList[highestStreakStart]).toLocaleString() + " to " + new Date(sortedList[highestStreakStart + highestCount]).toLocaleString());
    }

    let getBestDay = () => {
        if (successList.length > 0) {
            let deDupedDatesList = [...new Set(successList.map((el) => new Date(el)))];
            let daysArray = deDupedDatesList.reduce((returnArray, el) => {
                let simpleDate = new Date(el.getFullYear(), el.getMonth(), el.getDate(), 0, 0, 0, 0);
                if (returnArray.indexOf(simpleDate) === -1) {
                    returnArray.push(simpleDate);
                }
                return returnArray;
            }, []);
            let highestDayCount = 0;
            let bestDay;
            for (let i = 0; i < daysArray.length; i++) {
                let daySuccessCount = deDupedDatesList.filter((el) => (el.getFullYear() === daysArray[i].getFullYear() && el.getMonth() === daysArray[i].getMonth() && el.getDate() === daysArray[i].getDate())).length;
                if (daySuccessCount > highestDayCount) {
                    highestDayCount = daySuccessCount;
                    bestDay = daysArray[i];
                }
            }
            return ("Best day is " + bestDay.toLocaleDateString() + " with " + highestDayCount.toString() + " productive blocks");
        }
    }
    */

    let rows = [...Array(props.hrsToShow).keys()].map(i => {
        let loopHour = props.startDate.getHours() + i;
        let newDate = new Date(props.startDate.getTime()); //clone date
        newDate.setHours(loopHour, 0, 0, 0);
        loopHour = newDate.getHours();

        let checkedTime = checkTime(newDate);

        let twelveHr = newDate.getHours() % 12 || 12;
        let amPm = newDate.getHours() < 12 ? "a" : "p";

        let hrsSoFarInRow = 6;

        let loopHourTime = newDate.getTime();
        let currHourTime = currHour.getTime();

        if (loopHourTime === currHour.getTime()) {
            hrsSoFarInRow = Math.floor(now.getMinutes() / 10);
        }

        let rowClassName = loopHourTime === currHour.getTime() ? "currHour" : "";

        if (i === 0) {
            rowClassName += " first";
        }

        if (i === props.hrsToShow - 1) {
            rowClassName += " last";
        }

        return (
            <tr key={loopHourTime} className={rowClassName}>
                <td className="hour">{props.twentyFour ? loopHour : twelveHr}
                    {props.twentyFour ? '' : <span className="amPm">{amPm}</span>}</td>

                <MinuteBlocks hour={loopHour} handleClick={handleClick} getStatus={getStatus}
                    compPct={loopHourTime === currHourTime ? compPct : (checkedTime === 1 ? 0 : 1)}
                    date={newDate} isWorking={props.isWorking} justUpdated={justUpdated} />

                <td className="hourEff">
                    <span className="hourEffContent">{(checkedTime === 1) || (hrsSoFarInRow === 0) ? "" : hourEffCount(loopHour)}</span>
                </td>
            </tr>
        );
    });

    let updatedStatus = "";
    if (successList[successList.length - 1] === justUpdated) { updatedStatus = "success"; }
    else if (failList[failList.length - 1] === justUpdated) { updatedStatus = "fail"; }

    return (
        <>
            <br />
            <div className="stats">
                <div className="todayStats"><span className="statsHeader">Today's results:</span>
                    <span className={"progress success legend" + (updatedStatus === "success" ? " justUpdated" : "")}>&nbsp;</span>x {dayEffCount(now)}
                    <span className={"progress fail legend" + (updatedStatus === "fail" ? " justUpdated" : "")}>&nbsp;</span>x {dayFailCount(now)}
                </div>
                <div className={"yesterdayStats" + (dayEffCount(yesterday) + dayFailCount(yesterday) > 0 ? "" : " hide")}>
                    <span className="statsHeader">Yesterday:</span>
                    <span className="progress success legend" >&nbsp;</span>x {dayEffCount(yesterday)}
                    <span className="progress fail legend" >&nbsp;</span>x {dayFailCount(yesterday)}
                </div>
            </div>

            <div className={"addEarlyRow" + (currHourShown ? "" : " spacerBottom")}><button onClick={() => updateStartDate(-1)}>∧</button></div>
            <div className="tableWrap">
                <table className="table">
                    <thead>
                        <tr>
                            <th></th><th>:00</th><th>:10</th><th>:20</th><th>:30</th><th>:40</th><th>:50</th>
                            <th className="effHeader"><span className={"effHeaderContent progress success legend" + (updatedStatus === "success" ? " justUpdated" : "")}>&nbsp;</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>

                        {rows}

                    </tbody>
                </table>
            </div>
            <div className={"addEarlyRow bottom" + (currHourShown ? "" : " spacerTop") + (props.initialDate.getTime() !== props.startDate.getTime() ? " show" : "")}><button onClick={() => updateStartDate(1)}>∨</button></div>
            <button className="reset" onClick={() => props.setStartDate(props.initialDate)}>Reset view</button>
        </>
    );
}

let emptyStorage = () => {
    localStorage.clear();
    firebase.firestore().clearPersistence().catch(error => {
        console.error('Could not clear persistence:', error.code);
    })
    window.location.reload();
}

let SettingsBox = (props) => {
    let rightWedge = <div className="rightWedge" />;
    return (
        <div className={"settingsBox" + (props.showSettings ? "" : " hide")} onClick={() => (props.showSettings ? '' : props.setShowSettings(!props.showSettings))}>
            <div style={{ float: 'right' }}>
                <button className="close" onClick={() => props.setShowSettings(!props.showSettings)}>
                    {props.showSettings ? "X" : rightWedge}</button>
            </div>
            <div className="settingsWrap">
                <h3>SETTINGS</h3>
                <label className="checkContainer">24-hour clock
 <input type="checkbox" id="24h" checked={props.twentyFour} onChange={() => props.setTwentyFour(!props.twentyFour)} />
                    <span className="checkmark" />
                </label>
                <div className="hrsToShowField">
                    <div>
                        <label className="checkContainer" htmlFor="hrsToShow" onClick={() => props.setHrsToShow(6)}>Show 6 hours at once
 <input type="radio" value={6} name="hrsToShow" checked={props.hrsToShow === 6 ? true : false} onChange={(e) => props.setHrsToShow(6)} />
                            <span className="radio" />
                        </label>
                    </div>
                    <div>
                        <label htmlFor="hrsToShow" className="checkContainer" onClick={() => props.setHrsToShow(12)}>Show 12 hours at once
 <input type="radio" value={12} checked={props.hrsToShow === 12 ? true : false} onChange={(e) => props.setHrsToShow(12)} name="hrsToShow" />
                            <span className="radio" />
                        </label>
                    </div>
                </div>

                <div><button className="normal" onClick={emptyStorage}>Clear local cache</button></div>
                <hr className="settingsDivider" />
                <LoginComponent firebaseAuth={props.firebaseAuth} uiConfig={props.uiConfig} isSignedIn={props.isSignedIn} 
                setIsSignedIn={props.setIsSignedIn} currUserState={props.currUserState} setCurrUserState={props.setCurrUserState} />
            </div>
        </div>
    );
}

let firebaseAuthObj = firebase.auth();

function App() {
    const [showSettings, setShowSettings] = useState(false);
    const [showInfo, setshowInfo] = useState(false);
    const [isSignedIn, setIsSignedIn] = useState(firebaseAuthObj.currentUser ? true : false);
    const [twentyFour, setTwentyFour] = useStateWithLocalStorage('twentyFour', false, Boolean);
    const [isWorking, setIsWorking] = useStateWithLocalStorage('isWorking', true, Boolean, isSignedIn);
    const [currUserState, setCurrUserState] = useState(firebaseAuthObj.currentUser);

    let initialDate = new Date();
    let showHrsBeforeNow = 1;
    if (!localStorage.getItem('successList') && !localStorage.getItem('failList') && !isSignedIn) {
        showHrsBeforeNow = 0;
    }
    initialDate.setHours(initialDate.getHours() - showHrsBeforeNow, 0, 0, 0);

    let initialHrsToShow = 6;

    const [hrsToShow, setHrsToShow] = useStateWithLocalStorage('hrsToShow', initialHrsToShow);
    const [startDate, setStartDate] = useState(initialDate);

    let handleWorkChange = () => {
        setIsWorking(!isWorking);
        if (currUserState) {
            let updated = updateDB(null,null,!isWorking,firebaseAuthObj);
            if (!updated) setCurrUserState(null);
        }
    }

    return (
        <>
            <div className="header">
                <div className="menuButtonWrapper">
                    <button className="menuButton" onClick={() => setShowSettings(!showSettings)}>
                        <div className="first"></div>
                        <div></div>
                        <div className="last"></div>
                    </button>
                </div>
                <div className="infoButtonWrapper"><button className="infoButton" onClick={() => setshowInfo(!showInfo)}>?</button></div>
                <a href="/"><h1>KAMPRAD</h1><span className="suffix">.xyz</span></a>

            </div>


            <SettingsBox twentyFour={twentyFour} setTwentyFour={setTwentyFour} showSettings={showSettings}
                setShowSettings={setShowSettings} setHrsToShow={setHrsToShow} hrsToShow={hrsToShow} 
                firebaseAuth={firebaseAuthObj} uiConfig={uiConfig} isSignedIn={isSignedIn} setIsSignedIn={setIsSignedIn}
                currUserState={currUserState} setCurrUserState={setCurrUserState} />

            <div className="wrap">
                <div id="tos" className="tos">{tos}</div>
                <div id="pp" className="pp">{pp}</div>
                <div className={"infoContainer" + (showInfo ? " show" : "")}>
                    <div className="infoContent">
                        <p>Inspired by Ingvar Kamprad's quote below, Kamprad.xyz is a productivity tool designed to help you <strong>make the most of your days, one 10-minute block at a time.</strong></p>
                        <p>Just flip the switch to indicate when you start and stop working, and Kamprad.xyz will keep track of your progress. Review your history by tapping the up arrow above the grid. Try to make each day (and each hour) more productive than the last!</p>
                    </div>
                </div>
                <div className="container">
                    <h2 className="day">{startDate.toLocaleString('default', { year: 'numeric', weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                    <div className="quoteInline"> &ldquo;You can do so much in 10 minutes&rsquo; time. Ten minutes, once gone, are gone for good. Divide your life into 10-minute units and sacrifice as few of them as possible in meaningless activity.&rdquo;
 <div className="quoteCite">-Ingvar Kamprad, founder of IKEA</div></div>
                    <table className="working">
                        <tbody>
                            <tr>
                                <td onClick={handleWorkChange} className={"workingMsg" + (isWorking ? " active" : "")} title="I'm using these 10 minutes to the fullest">I'm using these 10 minutes to the fullest</td>
                                <td className="switchWrapper">
                                    <Switch onColor={"darkgreen"} checked={isWorking} onChange={handleWorkChange} />
                                    {/* <input type="checkbox" checked={isWorking} onChange={()=>setIsWorking(!isWorking)} /> */}
                                </td><td onClick={handleWorkChange} className={"notWorkingMsg" + (isWorking ? "" : " active")} title="I'm sacrificing these 10 minutes to meaningless activity">I'm sacrificing these 10 minutes to meaningless activity</td>
                            </tr>
                        </tbody>
                    </table>
                    <HourBlocks startDate={startDate} hrsToShow={hrsToShow} twentyFour={twentyFour} isWorking={isWorking}
                        setIsWorking={setIsWorking} setStartDate={setStartDate} setHrsToShow={setHrsToShow} initialDate={initialDate}
                        initialHrsToShow={initialHrsToShow} firebaseAuth={firebaseAuthObj} 
                        currUserState={currUserState} setCurrUserState={setCurrUserState} />


                </div>
            </div>
            <div id="footer">
                <p>Photo credit - Flickr/Edward Stojakovic</p>
                <p>Kamprad.xyz v0.1 Alpha - August 2019 - Not affiliated with or endorsed by the estate of Ingvar Kamprad or IKEA</p>
                <p><button className="plainLink" onClick={()=>showPolicy('tos')}>Terms of use</button>&nbsp;<button className="plainLink" onClick={()=>showPolicy('pp')}>Privacy Policy</button></p>
            </div>
        </>
    );
}

export default App;