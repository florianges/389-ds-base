import cockpit from "cockpit";
import React from "react";
import { log_cmd } from "../tools.jsx";
import {
	Alert,
	Button,
	Checkbox,
	Form,
	FormAlert,
	FormSelect,
	FormSelectOption,
	Grid,
	GridItem,
	Spinner,
	Tab,
	Tabs,
	TabTitleText,
	TextInput,
	Text,
	TextContent,
	TextVariants
} from '@patternfly/react-core';
import {
	Select,
	SelectVariant,
	SelectOption
} from '@patternfly/react-core/deprecated';
import PropTypes from "prop-types";
import { SyncAltIcon } from '@patternfly/react-icons';

const _ = cockpit.gettext;

const general_attrs = [
    "nsslapd-pwpolicy-local",
    "passwordstoragescheme",
    "passwordadmindn",
    "passwordadminskipinfoupdate",
    "passwordtrackupdatetime",
    "nsslapd-allow-hashed-passwords",
    "nsslapd-pwpolicy-inherit-global",
    "passwordisglobalpolicy",
    "passwordchange",
    "passwordmustchange",
    "passwordhistory",
    "passwordinhistory",
    "passwordminage",
];

const exp_attrs = [
    "passwordexp",
    "passwordgracelimit",
    "passwordsendexpiringtime",
    "passwordmaxage",
    "passwordwarning",
];

const lockout_attrs = [
    "passwordlockout",
    "passwordunlock",
    "passwordlockoutduration",
    "passwordmaxfailure",
    "passwordresetfailurecount",
];

const syntax_attrs = [
    "passwordchecksyntax",
    "passwordminlength",
    "passwordmindigits",
    "passwordminalphas",
    "passwordminuppers",
    "passwordminlowers",
    "passwordminspecials",
    "passwordmin8bit",
    "passwordmaxrepeats",
    "passwordpalindrome",
    "passwordmaxsequence",
    "passwordmaxseqsets",
    "passwordmaxclasschars",
    "passwordmincategories",
    "passwordmintokenlength",
    "passwordbadwords",
    "passworduserattributes",
    "passworddictcheck",
];

const tpr_attrs = [
    "passwordtprmaxuse",
    "passwordtprdelayexpireat",
    "passwordtprdelayvalidfrom",
];

const password_storage_attrs = [
    "nsslapd-pwdpbkdf2numiterations"
];

const PBKDF2_SCHEMES = ['pbkdf2', 'pbkdf2-sha1', 'pbkdf2-sha256', 'pbkdf2-sha512'];

const isPBKDF2Scheme = (scheme) => {
    return PBKDF2_SCHEMES.includes(scheme.toLowerCase());
};

export class GlobalPwPolicy extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loading: true,
            loaded: false,
            saving: false,
            activeKey: 1,
            // Lists of all the attributes for each tab/section.
            // We use the exact attribute name for the ID of
            // each field, so we can loop over them to efficently
            // check for changes, and updating/saving the config.
            saveGeneralDisabled: true,
            savePasswordStorageDisabled: true,
            saveExpDisabled: true,
            saveLockoutDisabled: true,
            saveSyntaxDisabled: true,
            saveTPRDisabled: true,
            isSelectOpen: false,
        };

        // Toggle currently active tab
        this.handleNavSelect = (event, tabIndex) => {
            this.setState({
                activeTabKey: tabIndex
            });
        };

        this.handleGeneralChange = this.handleGeneralChange.bind(this);
        this.handleSaveGeneral = this.handleSaveGeneral.bind(this);
        this.handlePasswordStorageChange = this.handlePasswordStorageChange.bind(this);
        this.handleSavePasswordStorage = this.handleSavePasswordStorage.bind(this);
        this.handleExpChange = this.handleExpChange.bind(this);
        this.handleSaveExp = this.handleSaveExp.bind(this);
        this.handleLockoutChange = this.handleLockoutChange.bind(this);
        this.handleSaveLockout = this.handleSaveLockout.bind(this);
        this.handleSyntaxChange = this.handleSyntaxChange.bind(this);
        this.handleSaveSyntax = this.handleSaveSyntax.bind(this);
        this.handleTPRChange = this.handleTPRChange.bind(this);
        this.handleSaveTPR = this.handleSaveTPR.bind(this);
        this.handleLoadGlobal = this.handleLoadGlobal.bind(this);
        this.handleLoadPasswordStorage = this.handleLoadPasswordStorage.bind(this);
        // Select Typeahead
        this.handleSelectToggle = this.handleSelectToggle.bind(this);
        this.handleSelectClear = this.handleSelectClear.bind(this);
    }

    componentDidMount() {
        // Loading config TODO
        if (!this.state.loaded) {
            this.handleLoadGlobal();
        } else {
            this.props.enableTree();
        }
    }

    handleNavSelect(key) {
        this.setState({ activeKey: key });
    }

    handlePasswordStorageChange(e) {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        const attr = e.target.id.toLowerCase();
        let disableSaveBtn = true;

        for (const password_storage_attr of password_storage_attrs) {
            const storageAttr = password_storage_attr.toLowerCase();
            const oldValue = String(this.state['_' + storageAttr] || '');
            const newValue = String(value || '');

            if (attr === storageAttr && oldValue !== newValue) {
                disableSaveBtn = false;
                break;
            }
        }

        this.setState({
            [attr]: value || '',
            savePasswordStorageDisabled: disableSaveBtn,
        });
    }

    handleSavePasswordStorage() {
        if (!isPBKDF2Scheme(this.state.passwordstoragescheme)) {
            return;
        }
        this.setState({
            saving: true
        });

        const cmd = [
            'dsconf', '-j', "ldapi://%2fvar%2frun%2fslapd-" + this.props.serverId + ".socket",
            'plugin', 'pwstorage-scheme', this.state.passwordstoragescheme.toLowerCase(),
            'set-num-iterations', this.state[password_storage_attrs[0]]
        ];

        log_cmd("handleSavePasswordStorage", "Saving password storage settings", cmd);
        cockpit
            .spawn(cmd, { superuser: true, err: "message" })
            .done(content => {
                this.handleLoadGlobal();
                this.setState({
                    saving: false
                });
                this.props.addNotification(
                    "success",
                    _("Successfully updated number of iterations for password storage scheme")
                );
            })
            .fail(err => {
                const errMsg = JSON.parse(err);
                this.handleLoadGlobal();
                this.setState({
                    saving: false
                });
                this.props.addNotification(
                    "error",
                    cockpit.format(_("Error updating number of iterations for password storage scheme - $0"), errMsg.desc)
                );
            });
    }

    handleGeneralChange(e) {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        const attr = e.target.id;
        let disableSaveBtn = true;

        // Check if a setting was changed, if so enable the save button
        for (const general_attr of general_attrs) {
            if (attr === general_attr && this.state['_' + general_attr] !== value) {
                disableSaveBtn = false;
                break;
            }
        }

        // Now check for differences in values that we did not touch
        for (const general_attr of general_attrs) {
            if (attr !== general_attr && this.state['_' + general_attr] !== this.state[general_attr]) {
                disableSaveBtn = false;
                break;
            }
        }

        // Create state update object
        const stateUpdate = {
            [attr]: value,
            saveGeneralDisabled: disableSaveBtn,
        };

        this.setState(stateUpdate, () => {
            // If passwordstoragescheme was changed and it's a PBKDF2 scheme,
            // load the iterations value
            if (attr === 'passwordstoragescheme' && isPBKDF2Scheme(value)) {
                this.handleLoadPasswordStorage(true);
            }
        });
    }

    handleSaveGeneral() {
        this.setState({
            saving: true
        });
        if (!this.state.savePasswordStorageDisabled) {
            this.handleSavePasswordStorage();
        }
        if (this.state.saveGeneralDisabled) {
            this.setState({
                saving: false
            });
            return;
        }

        const cmd = [
            'dsconf', '-j', "ldapi://%2fvar%2frun%2fslapd-" + this.props.serverId + ".socket",
            'config', 'replace'
        ];

        for (const attr of general_attrs) {
            if (this.state['_' + attr] !== this.state[attr]) {
                let val = this.state[attr];
                if (typeof val === "boolean") {
                    if (val) {
                        val = "on";
                    } else {
                        val = "off";
                    }
                }
                cmd.push(attr + "=" + val);
            }
        }

        log_cmd("handleSaveGeneral", "Saving general pwpolicy settings", cmd);
        cockpit
                .spawn(cmd, { superuser: true, err: "message" })
                .done(content => {
                    this.handleLoadGlobal();
                    this.setState({
                        saving: false
                    });
                    this.props.addNotification(
                        "success",
                        _("Successfully updated password policy configuration")
                    );
                })
                .fail(err => {
                    const errMsg = JSON.parse(err);
                    this.handleLoadGlobal();
                    this.setState({
                        saving: false
                    });
                    this.props.addNotification(
                        "error",
                        cockpit.format(_("Error updating password policy configuration - $0"), errMsg.desc)
                    );
                });
    }

    handleUserChange(e) {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        const attr = e.target.id;
        let disableSaveBtn = true;

        // Check if a setting was changed, if so enable the save button
        for (const user_attr of this.state.user_attrs) {
            if (attr === user_attr && this.state['_' + user_attr] !== value) {
                disableSaveBtn = false;
                break;
            }
        }

        // Now check for differences in values that we did not touch
        for (const user_attr of this.state.user_attrs) {
            if (attr !== user_attr && this.state['_' + user_attr] !== this.state[user_attr]) {
                disableSaveBtn = false;
                break;
            }
        }

        this.setState({
            [attr]: value,
            saveUserDisabled: disableSaveBtn,
        });
    }

    handleExpChange(e) {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        const attr = e.target.id;
        let disableSaveBtn = true;

        // Check if a setting was changed, if so enable the save button
        for (const exp_attr of exp_attrs) {
            if (attr === exp_attr && this.state['_' + exp_attr] !== value) {
                disableSaveBtn = false;
                break;
            }
        }

        // Now check for differences in values that we did not touch
        for (const exp_attr of exp_attrs) {
            if (attr !== exp_attr && this.state['_' + exp_attr] !== this.state[exp_attr]) {
                disableSaveBtn = false;
                break;
            }
        }

        this.setState({
            [attr]: value,
            saveExpDisabled: disableSaveBtn,
        });
    }

    handleSaveExp() {
        this.setState({
            saving: true
        });

        const cmd = [
            'dsconf', '-j', "ldapi://%2fvar%2frun%2fslapd-" + this.props.serverId + ".socket",
            'config', 'replace'
        ];

        for (const attr of exp_attrs) {
            if (this.state['_' + attr] !== this.state[attr]) {
                let val = this.state[attr];
                if (typeof val === "boolean") {
                    if (val) {
                        val = "on";
                    } else {
                        val = "off";
                    }
                }
                cmd.push(attr + "=" + val);
            }
        }

        log_cmd("handleSaveExp", "Saving Expiration pwpolicy settings", cmd);
        cockpit
                .spawn(cmd, { superuser: true, err: "message" })
                .done(content => {
                    this.handleLoadGlobal();
                    this.setState({
                        saving: false
                    });
                    this.props.addNotification(
                        "success",
                        _("Successfully updated password policy configuration")
                    );
                })
                .fail(err => {
                    const errMsg = JSON.parse(err);
                    this.handleLoadGlobal();
                    this.setState({
                        saving: false
                    });
                    this.props.addNotification(
                        "error",
                        cockpit.format(_("Error updating password policy configuration - $0"), errMsg.desc)
                    );
                });
    }

    handleLockoutChange(e) {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        const attr = e.target.id;
        let disableSaveBtn = true;

        // Check if a setting was changed, if so enable the save button
        for (const lockout_attr of lockout_attrs) {
            if (attr === lockout_attr && this.state['_' + lockout_attr] !== value) {
                disableSaveBtn = false;
                break;
            }
        }

        // Now check for differences in values that we did not touch
        for (const lockout_attr of lockout_attrs) {
            if (attr !== lockout_attr && this.state['_' + lockout_attr] !== this.state[lockout_attr]) {
                disableSaveBtn = false;
                break;
            }
        }

        this.setState({
            [attr]: value,
            saveLockoutDisabled: disableSaveBtn,
        });
    }

    handleSaveLockout() {
        this.setState({
            saving: true
        });

        const cmd = [
            'dsconf', '-j', "ldapi://%2fvar%2frun%2fslapd-" + this.props.serverId + ".socket",
            'config', 'replace'
        ];

        for (const attr of lockout_attrs) {
            if (this.state['_' + attr] !== this.state[attr]) {
                let val = this.state[attr];
                if (typeof val === "boolean") {
                    if (val) {
                        val = "on";
                    } else {
                        val = "off";
                    }
                }
                cmd.push(attr + "=" + val);
            }
        }

        log_cmd("handleSaveLockout", "Saving lockout pwpolicy settings", cmd);
        cockpit
                .spawn(cmd, { superuser: true, err: "message" })
                .done(content => {
                    this.handleLoadGlobal();
                    this.setState({
                        saving: false
                    });
                    this.props.addNotification(
                        "success",
                        _("Successfully updated password policy configuration")
                    );
                })
                .fail(err => {
                    const errMsg = JSON.parse(err);
                    this.handleLoadGlobal();
                    this.setState({
                        saving: false
                    });
                    this.props.addNotification(
                        "error",
                        cockpit.format(_("Error updating password policy configuration - $0"), errMsg.desc)
                    );
                });
    }

    handleSyntaxChange = (e, selection, isPlaceholder) => {
        let attr;
        let value;

        if (selection) {
            attr = "passworduserattributes";
            value = selection;
        } else {
            value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
            attr = e.target.id;
        }
        let disableSaveBtn = true;

        // Check if a setting was changed, if so enable the save button
        for (const syntax_attr of syntax_attrs) {
            if (syntax_attr === 'passworduserattributes' && attr === 'passworduserattributes') {
                const orig_val = this.state['_' + syntax_attr].join(' ');
                if (orig_val !== value) {
                    value = selection; // restore value
                    disableSaveBtn = false;
                    break;
                }
                value = selection; // restore value
            } else if (attr === syntax_attr && this.state['_' + syntax_attr] !== value) {
                disableSaveBtn = false;
                break;
            }
        }

        // Now check for differences in values that we did not touch
        for (const syntax_attr of syntax_attrs) {
            if (syntax_attr === 'passworduserattributes' && attr !== 'passworduserattributes') {
                // Typeahead attribute needs special care
                const orig_val = this.state['_' + syntax_attr].join(' ');
                const new_val = this.state[syntax_attr].join(' ');
                if (orig_val !== new_val) {
                    disableSaveBtn = false;
                    break;
                }
            } else if (attr !== syntax_attr && this.state['_' + syntax_attr] !== this.state[syntax_attr]) {
                disableSaveBtn = false;
                break;
            }
        }
        if (selection) {
            if (this.state[attr].includes(selection)) {
                this.setState(
                    (prevState) => ({
                        [attr]: prevState[attr].filter((item) => item !== selection),
                        isSelectOpen: false
                    }),
                );
            } else {
                this.setState(
                    (prevState) => ({
                        [attr]: [...prevState[attr], selection],
                        saveSyntaxDisabled: disableSaveBtn,
                        isSelectOpen: false

                    }),
                );
            }
        } else {
            this.setState({
                [attr]: value,
                saveSyntaxDisabled: disableSaveBtn,
                isSelectOpen: false
            });
        }
    };

    handleSaveSyntax() {
        this.setState({
            saving: true
        });

        const cmd = [
            'dsconf', '-j', "ldapi://%2fvar%2frun%2fslapd-" + this.props.serverId + ".socket",
            'config', 'replace'
        ];

        for (const attr of syntax_attrs) {
            if (this.state['_' + attr] !== this.state[attr]) {
                let val = this.state[attr];
                if (typeof val === "boolean") {
                    if (val) {
                        val = "on";
                    } else {
                        val = "off";
                    }
                }
                cmd.push(attr + "=" + val);
            }
        }

        log_cmd("handleSaveSyntax", "Saving syntax checking pwpolicy settings", cmd);
        cockpit
                .spawn(cmd, { superuser: true, err: "message" })
                .done(content => {
                    this.handleLoadGlobal();
                    this.setState({
                        saving: false
                    });
                    this.props.addNotification(
                        "success",
                        _("Successfully updated password policy configuration")
                    );
                })
                .fail(err => {
                    const errMsg = JSON.parse(err);
                    this.handleLoadGlobal();
                    this.setState({
                        saving: false
                    });
                    this.props.addNotification(
                        "error",
                        cockpit.format(_("Error updating password policy configuration - $0"), errMsg.desc)
                    );
                });
    }

    handleTPRChange(e) {
        const value = e.target.value;
        const attr = e.target.id;
        let disableSaveBtn = true;

        // Check if a setting was changed, if so enable the save button
        for (const tpr_attr of tpr_attrs) {
            if (attr === tpr_attr && this.state['_' + tpr_attr] !== value) {
                disableSaveBtn = false;
                break;
            }
        }

        // Now check for differences in values that we did not touch
        for (const tpr_attr of tpr_attrs) {
            if (attr !== tpr_attr && this.state['_' + tpr_attr] !== this.state[tpr_attr]) {
                disableSaveBtn = false;
                break;
            }
        }

        this.setState({
            [attr]: value,
            saveTPRDisabled: disableSaveBtn,
        });
    }

    handleSaveTPR() {
        this.setState({
            saving: true
        });

        const cmd = [
            'dsconf', '-j', "ldapi://%2fvar%2frun%2fslapd-" + this.props.serverId + ".socket",
            'config', 'replace'
        ];

        for (const attr of tpr_attrs) {
            if (this.state['_' + attr] !== this.state[attr]) {
                const val = this.state[attr];
                cmd.push(attr + "=" + val);
            }
        }

        log_cmd("handleSaveTPR", "Saving TPR settings", cmd);
        cockpit
                .spawn(cmd, { superuser: true, err: "message" })
                .done(content => {
                    this.handleLoadGlobal();
                    this.setState({
                        saving: false
                    });
                    this.props.addNotification(
                        "success",
                        _("Successfully updated password policy configuration")
                    );
                })
                .fail(err => {
                    const errMsg = JSON.parse(err);
                    this.handleLoadGlobal();
                    this.setState({
                        saving: false
                    });
                    this.props.addNotification(
                        "error",
                        cockpit.format(_("Error updating password policy configuration - $0"), errMsg.desc)
                    );
                });
    }

    handleLoadPasswordStorage(skipLoading = false) {
        if (!skipLoading) {
            this.setState({
                loading: true
            });
        }

        if (!isPBKDF2Scheme(this.state.passwordstoragescheme)) {
            this.setState({
                loading: false,
                'nsslapd-pwdpbkdf2numiterations': '',
                '_nsslapd-pwdpbkdf2numiterations': ''
            });
            return;
        }

        const cmd = [
            'dsconf', '-j', "ldapi://%2fvar%2frun%2fslapd-" + this.props.serverId + ".socket",
            'plugin', 'pwstorage-scheme', this.state.passwordstoragescheme.toLowerCase(),
            'get-num-iterations'
        ];

        log_cmd("handleLoadPasswordStorage", "Load password storage settings", cmd);
        cockpit
            .spawn(cmd, { superuser: true, err: "message" })
            .done(content => {
                const config = JSON.parse(content);
                const attrs = config.attrs;

                const stateUpdates = {
                    'nsslapd-pwdpbkdf2numiterations': '',
                    '_nsslapd-pwdpbkdf2numiterations': ''
                };

                if (!skipLoading) {
                    stateUpdates["loading"] = false
                }
                password_storage_attrs.forEach(attr => {
                    const attrLower = attr.toLowerCase();
                    const attrValue = attrs[attr] || attrs[attrLower];

                    if (attrValue && attrValue[0]) {
                        stateUpdates[attrLower] = attrValue[0];
                        stateUpdates['_' + attrLower] = attrValue[0];
                    }
                });

                this.setState(stateUpdates);
            })
            .fail(err => {
                const errMsg = JSON.parse(err);
                this.setState({
                    loading: false,
                    'nsslapd-pwdpbkdf2numiterations': '',
                    '_nsslapd-pwdpbkdf2numiterations': ''
                });
                this.props.addNotification(
                    "error",
                    cockpit.format(_("Error loading password storage settings - $0"), errMsg.desc)
                );
            });
    }

    handleLoadGlobal() {
        this.setState({
            loading: true
        });

        const cmd = [
            "dsconf", "-j", "ldapi://%2fvar%2frun%2fslapd-" + this.props.serverId + ".socket",
            "config", "get"
        ];
        log_cmd("handleLoadGlobal", "Load global password policy", cmd);
        cockpit
                .spawn(cmd, { superuser: true, err: "message" })
                .done(content => {
                    const config = JSON.parse(content);
                    const attrs = config.attrs;
                    // Handle the checkbox values
                    let pwpLocal = false;
                    let pwIsGlobal = false;
                    let pwChange = false;
                    let pwMustChange = false;
                    let pwHistory = false;
                    let pwTrackUpdate = false;
                    let pwExpire = false;
                    let pwSendExpire = false;
                    let pwLockout = false;
                    let pwUnlock = false;
                    let pwCheckSyntax = false;
                    let pwPalindrome = false;
                    let pwDictCheck = false;
                    let pwAllowHashed = false;
                    let pwInheritGlobal = false;
                    let pwAdminSkipUpdates = false;
                    let pwUserAttrs = [];

                    if (attrs['nsslapd-pwpolicy-local'][0] === "on") {
                        pwpLocal = true;
                    }
                    if (attrs.passwordchange[0] === "on") {
                        pwChange = true;
                    }
                    if (attrs.passwordmustchange[0] === "on") {
                        pwMustChange = true;
                    }
                    if (attrs.passwordhistory[0] === "on") {
                        pwHistory = true;
                    }
                    if (attrs.passwordtrackupdatetime[0] === "on") {
                        pwTrackUpdate = true;
                    }
                    if (attrs.passwordisglobalpolicy[0] === "on") {
                        pwIsGlobal = true;
                    }
                    if (attrs.passwordsendexpiringtime[0] === "on") {
                        pwSendExpire = true;
                    }
                    if (attrs.passwordlockout[0] === "on") {
                        pwLockout = true;
                    }
                    if (attrs.passwordunlock[0] === "on") {
                        pwUnlock = true;
                    }
                    if (attrs.passwordexp[0] === "on") {
                        pwExpire = true;
                    }
                    if (attrs.passwordchecksyntax[0] === "on") {
                        pwCheckSyntax = true;
                    }
                    if (attrs.passwordpalindrome[0] === "on") {
                        pwPalindrome = true;
                    }
                    if (attrs.passworddictcheck[0] === "on") {
                        pwDictCheck = true;
                    }
                    if (attrs['nsslapd-allow-hashed-passwords'][0] === "on") {
                        pwAllowHashed = true;
                    }
                    if (attrs['nsslapd-pwpolicy-inherit-global'][0] === "on") {
                        pwInheritGlobal = true;
                    }
                    if (attrs.passwordadminskipinfoupdate[0] === "on") {
                        pwAdminSkipUpdates = true;
                    }
                    if (attrs.passwordbadwords[0] !== "") {
                        // Hack until this is fixed: https://github.com/389ds/389-ds-base/issues/3928
                        if (attrs.passwordbadwords.length > 1) {
                            attrs.passwordbadwords[0] = attrs.passwordbadwords.join(' ');
                        }
                    }
                    if (attrs.passworduserattributes[0] !== "") {
                        if (attrs.passworduserattributes.length > 1) {
                            // Hack until this is fixed: https://github.com/389ds/389-ds-base/issues/3928
                            attrs.passworduserattributes[0] = attrs.passworduserattributes.join(' ');
                        }
                        // Could be space or comma separated list
                        if (attrs.passworduserattributes[0].indexOf(',') > -1) {
                            pwUserAttrs = attrs.passworduserattributes[0].trim();
                            pwUserAttrs = pwUserAttrs.split(',');
                        } else {
                            pwUserAttrs = attrs.passworduserattributes[0].split(' ');
                        }
                    }

                    this.setState(() => (
                        {
                            loaded: true,
                            loading: false,
                            saveGeneralDisabled: true,
                            savePasswordStorageDisabled: true,
                            saveUserDisabled: true,
                            saveExpDisabled: true,
                            saveLockoutDisabled: true,
                            saveSyntaxDisabled: true,
                            saveTPRDisabled: true,
                            // Settings
                            'nsslapd-pwpolicy-local': pwpLocal,
                            passwordisglobalpolicy: pwIsGlobal,
                            passwordchange: pwChange,
                            passwordmustchange: pwMustChange,
                            passwordhistory: pwHistory,
                            passwordtrackupdatetime: pwTrackUpdate,
                            passwordexp: pwExpire,
                            passwordsendexpiringtime: pwSendExpire,
                            passwordlockout: pwLockout,
                            passwordunlock: pwUnlock,
                            passwordchecksyntax: pwCheckSyntax,
                            passwordpalindrome: pwPalindrome,
                            passworddictcheck: pwDictCheck,
                            'nsslapd-allow-hashed-passwords': pwAllowHashed,
                            'nsslapd-pwpolicy-inherit-global': pwInheritGlobal,
                            passwordstoragescheme: attrs.passwordstoragescheme[0],
                            passwordinhistory: attrs.passwordinhistory[0],
                            passwordwarning: attrs.passwordwarning[0],
                            passwordmaxage: attrs.passwordmaxage[0],
                            passwordminage: attrs.passwordminage[0],
                            passwordgracelimit: attrs.passwordgracelimit[0],
                            passwordlockoutduration: attrs.passwordlockoutduration[0],
                            passwordmaxfailure: attrs.passwordmaxfailure[0],
                            passwordresetfailurecount: attrs.passwordresetfailurecount[0],
                            passwordminlength: attrs.passwordminlength[0],
                            passwordmindigits: attrs.passwordmindigits[0],
                            passwordminalphas: attrs.passwordminalphas[0],
                            passwordminuppers: attrs.passwordminuppers[0],
                            passwordminlowers: attrs.passwordminlowers[0],
                            passwordminspecials: attrs.passwordminspecials[0],
                            passwordmin8bit: attrs.passwordmin8bit[0],
                            passwordmaxrepeats: attrs.passwordmaxrepeats[0],
                            passwordmaxsequence: attrs.passwordmaxsequence[0],
                            passwordmaxseqsets: attrs.passwordmaxseqsets[0],
                            passwordmaxclasschars: attrs.passwordmaxclasschars[0],
                            passwordmincategories: attrs.passwordmincategories[0],
                            passwordmintokenlength: attrs.passwordmintokenlength[0],
                            passwordbadwords: attrs.passwordbadwords[0],
                            passworduserattributes: pwUserAttrs,
                            passwordadmindn: attrs.passwordadmindn[0],
                            passwordadminskipinfoupdate: pwAdminSkipUpdates,
                            passwordtprmaxuse: attrs.passwordtprmaxuse[0],
                            passwordtprdelayexpireat: attrs.passwordtprdelayexpireat[0],
                            passwordtprdelayvalidfrom: attrs.passwordtprdelayvalidfrom[0],
                            // Record original values
                            '_nsslapd-pwpolicy-local': pwpLocal,
                            _passwordisglobalpolicy: pwIsGlobal,
                            _passwordchange: pwChange,
                            _passwordmustchange: pwMustChange,
                            _passwordhistory: pwHistory,
                            _passwordtrackupdatetime: pwTrackUpdate,
                            _passwordexp: pwExpire,
                            _passwordsendexpiringtime: pwSendExpire,
                            _passwordlockout: pwLockout,
                            _passwordunlock: pwUnlock,
                            _passwordchecksyntax: pwCheckSyntax,
                            _passwordpalindrome: pwPalindrome,
                            _passworddictcheck: pwDictCheck,
                            '_nsslapd-allow-hashed-passwords': pwAllowHashed,
                            '_nsslapd-pwpolicy-inherit-global': pwInheritGlobal,
                            _passwordstoragescheme: attrs.passwordstoragescheme[0],
                            _passwordinhistory: attrs.passwordinhistory[0],
                            _passwordwarning: attrs.passwordwarning[0],
                            _passwordmaxage: attrs.passwordmaxage[0],
                            _passwordminage: attrs.passwordminage[0],
                            _passwordgracelimit: attrs.passwordgracelimit[0],
                            _passwordlockoutduration: attrs.passwordlockoutduration[0],
                            _passwordmaxfailure: attrs.passwordmaxfailure[0],
                            _passwordresetfailurecount: attrs.passwordresetfailurecount[0],
                            _passwordminlength: attrs.passwordminlength[0],
                            _passwordmindigits: attrs.passwordmindigits[0],
                            _passwordminalphas: attrs.passwordminalphas[0],
                            _passwordminuppers: attrs.passwordminuppers[0],
                            _passwordminlowers: attrs.passwordminlowers[0],
                            _passwordminspecials: attrs.passwordminspecials[0],
                            _passwordmin8bit: attrs.passwordmin8bit[0],
                            _passwordmaxrepeats: attrs.passwordmaxrepeats[0],
                            _passwordmaxsequence: attrs.passwordmaxsequence[0],
                            _passwordmaxseqsets: attrs.passwordmaxseqsets[0],
                            _passwordmaxclasschars: attrs.passwordmaxclasschars[0],
                            _passwordmincategories: attrs.passwordmincategories[0],
                            _passwordmintokenlength: attrs.passwordmintokenlength[0],
                            _passwordbadwords: attrs.passwordbadwords[0],
                            _passworduserattributes: pwUserAttrs,
                            _passwordadmindn: attrs.passwordadmindn[0],
                            _passwordadminskipinfoupdate: pwAdminSkipUpdates,
                            _passwordtprmaxuse: attrs.passwordtprmaxuse[0],
                            _passwordtprdelayexpireat: attrs.passwordtprdelayexpireat[0],
                            _passwordtprdelayvalidfrom: attrs.passwordtprdelayvalidfrom[0],
                        }), () => {
                            this.props.enableTree();
                            this.handleLoadPasswordStorage();
                        });
                })
                .fail(err => {
                    const errMsg = JSON.parse(err);
                    this.setState({
                        loaded: true,
                        loading: false,
                    });
                    this.props.addNotification(
                        "error",
                        cockpit.format(_("Error loading global password policy - $0"), errMsg.desc)
                    );
                });
    }

    handleSelectToggle = (_event, isSelectOpen) => {
        this.setState({
            isSelectOpen
        });
    };

    handleSelectClear = () => {
        this.setState({
            passworduserattributes: [],
            isSelectOpen: false
        });
    };

    render() {
        let pwp_element = "";
        let pwExpirationRows = "";
        let pwLockoutRows = "";
        let pwSyntaxRows = "";
        let saveBtnName = _("Save");
        const extraPrimaryProps = {};
        if (this.state.saving) {
            saveBtnName = _("Saving ...");
            extraPrimaryProps.spinnerAriaValueText = _("Saving");
        }

        if (this.state.passwordchecksyntax) {
            pwSyntaxRows = (
                <div className="ds-margin-left">
                    <Grid className="ds-margin-top">
                        <GridItem className="ds-label" span={3}>
                            {_("Minimum Length")}
                        </GridItem>
                        <GridItem span={1}>
                            <TextInput
                                title={_("The minimum number of characters in the password (passwordMinLength).")}
                                value={this.state.passwordminlength}
                                type="number"
                                id="passwordminlength"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordminlength"
                                onChange={(e, checked) => {
                                    this.handleSyntaxChange(e);
                                }}
                            />
                        </GridItem>
                        <GridItem className="ds-label" offset={6} span={3}>
                            {_("Minimum Alpha's")}
                        </GridItem>
                        <GridItem span={1}>
                            <TextInput
                                title={_("Reject passwords with fewer than this many alpha characters (passwordMinAlphas).")}
                                value={this.state.passwordminalphas}
                                type="number"
                                id="passwordminalphas"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordminalphas"
                                onChange={(e, checked) => {
                                    this.handleSyntaxChange(e);
                                }}
                            />
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top">
                        <GridItem className="ds-label" span={3}>
                            {_("Minimum Digits")}
                        </GridItem>
                        <GridItem span={1}>
                            <TextInput
                                title={_("Reject passwords with fewer than this many digit characters (0-9) (passwordMinDigits).")}
                                value={this.state.passwordmindigits}
                                type="number"
                                id="passwordmindigits"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordmindigits"
                                onChange={(e, checked) => {
                                    this.handleSyntaxChange(e);
                                }}
                            />
                        </GridItem>
                        <GridItem className="ds-label" offset={6} span={3}>
                            {_("Minimum Special")}
                        </GridItem>
                        <GridItem span={1}>
                            <TextInput
                                title={_("Reject passwords with fewer than this many special non-alphanumeric characters (passwordMinSpecials).")}
                                value={this.state.passwordminspecials}
                                type="number"
                                id="passwordminspecials"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordminspecials"
                                onChange={(e, checked) => {
                                    this.handleSyntaxChange(e);
                                }}
                            />
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top">
                        <GridItem className="ds-label" span={3}>
                            {_("Minimum Uppercase")}
                        </GridItem>
                        <GridItem span={1}>
                            <TextInput
                                title={_("Reject passwords with fewer than this many uppercase characters (passwordMinUppers).")}
                                value={this.state.passwordminuppers}
                                type="number"
                                id="passwordminuppers"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordminuppers"
                                onChange={(e, checked) => {
                                    this.handleSyntaxChange(e);
                                }}
                            />
                        </GridItem>
                        <GridItem className="ds-label" offset={6} span={3}>
                            {_("Minimum Lowercase")}
                        </GridItem>
                        <GridItem span={1}>
                            <TextInput
                                title={_("Reject passwords with fewer than this many lowercase characters (passwordMinLowers).")}
                                value={this.state.passwordminlowers}
                                type="number"
                                id="passwordminlowers"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordminlowers"
                                onChange={(e, checked) => {
                                    this.handleSyntaxChange(e);
                                }}
                            />
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top">
                        <GridItem className="ds-label" span={3}>
                            {_("Minimum 8-bit")}
                        </GridItem>
                        <GridItem span={1}>
                            <TextInput
                                title={_("Reject passwords with fewer than this many 8-bit or multi-byte characters (passwordMin8Bit).")}
                                value={this.state.passwordmin8bit}
                                type="number"
                                id="passwordmin8bit"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordmin8bit"
                                onChange={(e, checked) => {
                                    this.handleSyntaxChange(e);
                                }}
                            />
                        </GridItem>
                        <GridItem className="ds-label" offset={6} span={3}>
                            {_("Minimum Categories")}
                        </GridItem>
                        <GridItem span={1}>
                            <TextInput
                                title={_("The minimum number of character categories that a password must contain (categories are upper, lower, digit, special, and 8-bit) (passwordMinCategories).")}
                                value={this.state.passwordmincategories}
                                type="number"
                                id="passwordmincategories"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordmincategories"
                                onChange={(e, checked) => {
                                    this.handleSyntaxChange(e);
                                }}
                            />
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top">
                        <GridItem className="ds-label" span={3}>
                            {_("Maximum Sequences")}
                        </GridItem>
                        <GridItem span={1}>
                            <TextInput
                                title={_("The maximum number of allowed monotonic characters sequences (passwordMaxSequence).")}
                                value={this.state.passwordmaxsequence}
                                type="number"
                                id="passwordmaxsequence"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordmaxsequence"
                                onChange={(e, checked) => {
                                    this.handleSyntaxChange(e);
                                }}
                            />
                        </GridItem>
                        <GridItem className="ds-label" offset={6} span={3}>
                            {_("Max Sequence Sets")}
                        </GridItem>
                        <GridItem span={1}>
                            <TextInput
                                title={_("The maximum number of allowed monotonic characters sequences that can appear more than once (passwordMaxSeqSets).")}
                                value={this.state.passwordmaxseqsets}
                                type="number"
                                id="passwordmaxseqsets"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordmaxseqsets"
                                onChange={(e, checked) => {
                                    this.handleSyntaxChange(e);
                                }}
                            />
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top">
                        <GridItem className="ds-label" span={3}>
                            {_("Max Seq Per Class")}
                        </GridItem>
                        <GridItem span={1}>
                            <TextInput
                                title={_("The maximum number of consecutive characters from the same character class/category (passwordMaxClassChars).")}
                                value={this.state.passwordmaxclasschars}
                                type="number"
                                id="passwordmaxclasschars"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordmaxclasschars"
                                onChange={(e, checked) => {
                                    this.handleSyntaxChange(e);
                                }}
                            />
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top">
                        <GridItem className="ds-label" span={3}>
                            {_("Prohibited Words")}
                        </GridItem>
                        <GridItem span={9}>
                            <TextInput
                                title={_("A space-separated list of words that are not allowed to be contained in the new password (passwordBadWords).")}
                                value={this.state.passwordbadwords}
                                type="text"
                                id="passwordbadwords"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordbadwords"
                                onChange={(e, checked) => {
                                    this.handleSyntaxChange(e);
                                }}
                            />
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top" title={_("A list of entry attributes to compare to the new password (passwordUserAttributes).")}>
                        <GridItem className="ds-label" span={3}>
                            {_("Check User Attributes")}
                        </GridItem>
                        <GridItem span={9}>
                            <Select
                                variant={SelectVariant.typeaheadMulti}
                                typeAheadAriaLabel="Type an attribute to check"
                                onToggle={(_event, isSelectOpen) => this.handleSelectToggle(isSelectOpen)}
                                onClear={this.handleSelectClear}
                                onSelect={this.handleSyntaxChange}
                                selections={this.state.passworduserattributes}
                                isOpen={this.state.isSelectOpen}
                                aria-labelledby="typeAhead-user-attr"
                                placeholderText={_("Type attributes to check...")}
                                noResultsFoundText="There are no matching entries"
                            >
                                {this.props.attrs.map((attr, index) => (
                                    <SelectOption
                                        key={index}
                                        value={attr}
                                    />
                                ))}
                            </Select>
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top-lg" title={_("Check the password against the system's CrackLib dictionary (passwordDictCheck).")}>
                        <GridItem span={12}>
                            <Checkbox
                                id="passworddictcheck"
                                isChecked={this.state.passworddictcheck}
                                onChange={(e, checked) => {
                                    this.handleSyntaxChange(e);
                                }}
                                label={_("Dictionary Check")}
                            />
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top" title={_("Check if the password is a palindrome (passwordPalindrome).")}>
                        <GridItem span={12}>
                            <Checkbox
                                id="passwordpalindrome"
                                isChecked={this.state.passwordpalindrome}
                                className="ds-label"
                                onChange={(e, checked) => {
                                    this.handleSyntaxChange(e);
                                }}
                                label={_("Reject Palindromes")}
                            />
                        </GridItem>
                    </Grid>
                </div>
            );
        }

        if (this.state.passwordlockout) {
            pwLockoutRows = (
                <div className="ds-margin-left">
                    <Grid className="ds-margin-top" title={_("The maximum number of failed logins before account gets locked (passwordMaxFailure).")}>
                        <GridItem className="ds-label" span={5}>
                            {_("Number of Failed Logins That Locks out Account")}
                        </GridItem>
                        <GridItem span={2}>
                            <TextInput
                                value={this.state.passwordmaxfailure}
                                type="number"
                                id="passwordmaxfailure"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordmaxpasswordmaxfailureclasschars"
                                onChange={(e, checked) => {
                                    this.handleLockoutChange(e);
                                }}
                            />
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top" title={_("The number of seconds until an accounts failure count is reset (passwordResetFailureCount).")}>
                        <GridItem className="ds-label" span={5}>
                            {_("Time Until <i>Failure Count</i> Resets")}
                        </GridItem>
                        <GridItem span={2}>
                            <TextInput
                                value={this.state.passwordresetfailurecount}
                                type="number"
                                id="passwordresetfailurecount"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordresetfailurecount"
                                onChange={(e, checked) => {
                                    this.handleLockoutChange(e);
                                }}
                            />
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top" title={_("The number of seconds, duration, before the account gets unlocked (passwordLockoutDuration).")}>
                        <GridItem className="ds-label" span={5}>
                            {_("Time Until Account Unlocked")}
                        </GridItem>
                        <GridItem span={2}>
                            <TextInput
                                value={this.state.passwordlockoutduration}
                                type="number"
                                id="passwordlockoutduration"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordlockoutduration"
                                onChange={(e, checked) => {
                                    this.handleLockoutChange(e);
                                }}
                            />
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top" title={_("Do not lockout the user account forever, instead the account will unlock based on the lockout duration (passwordUnlock).")}>
                        <GridItem className="ds-label" span={5}>
                            <Checkbox
                                id="passwordunlock"
                                isChecked={this.state.passwordunlock}
                                onChange={(e, checked) => {
                                    this.handleLockoutChange(e);
                                }}
                                label={_("Do Not Lockout Account Forever")}
                            />
                        </GridItem>
                    </Grid>
                </div>
            );
        }

        if (this.state.passwordexp) {
            pwExpirationRows = (
                <div className="ds-margin-left">
                    <Grid className="ds-margin-top" title={_("The maximum age of a password in seconds before it expires (passwordMaxAge).")}>
                        <GridItem className="ds-label" span={5}>
                            {_("Password Expiration Time")}
                        </GridItem>
                        <GridItem span={2}>
                            <TextInput
                                value={this.state.passwordmaxage}
                                type="number"
                                id="passwordmaxage"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordmaxage"
                                onChange={(e, checked) => {
                                    this.handleExpChange(e);
                                }}
                            />
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top" title={_("The number of logins that are allowed after the password has expired (passwordGraceLimit).")}>
                        <GridItem className="ds-label" span={5}>
                            {_("Allowed Logins After Password Expires")}
                        </GridItem>
                        <GridItem span={2}>
                            <TextInput
                                value={this.state.passwordgracelimit}
                                type="number"
                                id="passwordgracelimit"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordgracelimit"
                                onChange={(e, checked) => {
                                    this.handleExpChange(e);
                                }}
                            />
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top" title={_("Set the time (in seconds), before a password is about to expire, to send a warning. (passwordWarning).")}>
                        <GridItem className="ds-label" span={5}>
                            {_("Send Password Expiring Warning")}
                        </GridItem>
                        <GridItem span={2}>
                            <TextInput
                                value={this.state.passwordwarning}
                                type="number"
                                id="passwordwarning"
                                aria-describedby="horizontal-form-name-helper"
                                name="passwordwarning"
                                onChange={(e, checked) => {
                                    this.handleExpChange(e);
                                }}
                            />
                        </GridItem>
                    </Grid>
                    <Grid className="ds-margin-top" title={_("Always return a password expiring control when requested (passwordSendExpiringTime).")}>
                        <GridItem className="ds-label" span={5}>
                            <Checkbox
                                id="passwordsendexpiringtime"
                                isChecked={this.state.passwordsendexpiringtime}
                                onChange={(e, checked) => {
                                    this.handleExpChange(e);
                                }}
                                label={_("Always send Password Expiring Control")}
                            />
                        </GridItem>
                    </Grid>
                </div>
            );
        }

        if (this.state.loading || !this.state.loaded) {
            pwp_element = (
                <div className="ds-margin-top-xlg ds-center">
                    <Spinner  size="xl" />
                </div>
            );
        } else {
            pwp_element = (
                <div className={this.state.loading ? 'ds-fadeout ds-margin-bottom-md' : 'ds-fadein ds-left-margin ds-margin-bottom-md'}>
                    <Tabs isFilled className="ds-margin-top-lg" activeKey={this.state.activeTabKey} onSelect={this.handleNavSelect}>
                        <Tab eventKey={0} title={<TabTitleText>{_("General Settings")}</TabTitleText>}>
                            <Form className="ds-margin-left-sm" isHorizontal autoComplete="off">
                                <Grid className="ds-margin-top-xlg" title={_("Allow subtree/user defined local password policies (nsslapd-pwpolicy-local).")}>
                                    <GridItem span={12}>
                                        <Checkbox
                                            id="nsslapd-pwpolicy-local"
                                            isChecked={this.state['nsslapd-pwpolicy-local']}
                                            onChange={(e, checked) => {
                                                this.handleGeneralChange(e);
                                            }}
                                            label={_("Allow Local Password Policies")}
                                        />
                                    </GridItem>
                                </Grid>
                                <Grid title={_("If a local password policy does not defined any syntax rules then inherit the local policy syntax (nsslapd-pwpolicy-inherit-global).")}>
                                    <GridItem span={12}>
                                        <Checkbox
                                            id="nsslapd-pwpolicy-inherit-global"
                                            isChecked={this.state["nsslapd-pwpolicy-inherit-global"]}
                                            onChange={(e, checked) => {
                                                this.handleGeneralChange(e);
                                            }}
                                            label={_("Local Policies Inherit Global Policy")}
                                        />
                                    </GridItem>
                                </Grid>
                                <Grid title={_("Allow anyone to add a prehashed password (nsslapd-allow-hashed-passwords).")}>
                                    <GridItem span={12}>
                                        <Checkbox
                                            id="nsslapd-allow-hashed-passwords"
                                            isChecked={this.state["nsslapd-allow-hashed-passwords"]}
                                            onChange={(e, checked) => {
                                                this.handleGeneralChange(e);
                                            }}
                                            label={_("Allow Adding Pre-Hashed Passwords")}
                                        />
                                    </GridItem>
                                </Grid>
                                <Grid title={_("Allow password policy state attributes to replicate (passwordIsGlobalPolicy).")}>
                                    <GridItem span={12}>
                                        <Checkbox
                                            id="passwordisglobalpolicy"
                                            isChecked={this.state.passwordisglobalpolicy}
                                            onChange={(e, checked) => {
                                                this.handleGeneralChange(e);
                                            }}
                                            label={_("Replicate Password Policy State Attributes")}
                                        />
                                    </GridItem>
                                </Grid>
                                <Grid title={_("Record a separate timestamp specifically for the last time that the password for an entry was changed. If this is enabled, then it adds the pwdUpdateTime operational attribute to the user account entry (passwordTrackUpdateTime).")}>
                                    <GridItem span={12}>
                                        <Checkbox
                                            id="passwordtrackupdatetime"
                                            isChecked={this.state.passwordtrackupdatetime}
                                            onChange={(e, checked) => {
                                                this.handleGeneralChange(e);
                                            }}
                                            label={_("Track Password Update Time")}
                                        />
                                    </GridItem>
                                </Grid>
                                <Grid title={_("Allow user's to change their passwords (passwordChange).")}>
                                    <GridItem span={12}>
                                        <Checkbox
                                            id="passwordchange"
                                            isChecked={this.state.passwordchange}
                                            onChange={(e, checked) => {
                                                this.handleGeneralChange(e);
                                            }}
                                            label={_("Allow Users To Change Their Passwords")}
                                        />
                                    </GridItem>
                                </Grid>
                                <Grid title={_("User must change its password after its been reset by an administrator (passwordMustChange).")}>
                                    <GridItem span={12}>
                                        <Checkbox
                                            id="passwordmustchange"
                                            isChecked={this.state.passwordmustchange}
                                            onChange={(e, checked) => {
                                                this.handleGeneralChange(e);
                                            }}
                                            label={_("User Must Change Password After Reset")}
                                        />
                                    </GridItem>
                                </Grid>
                                <Grid title={_("Maintain a password history for each user (passwordHistory).")}>
                                    <GridItem span={12}>
                                        <div className="ds-inline">
                                            <Checkbox
                                                id="passwordhistory"
                                                isChecked={this.state.passwordhistory}
                                                onChange={(e, checked) => {
                                                    this.handleGeneralChange(e);
                                                }}
                                                label={_("Keep Password History")}
                                            />
                                        </div>
                                        <div className="ds-inline ds-left-margin ds-raise-field-md ds-width-sm">
                                            <TextInput
                                                value={this.state.passwordinhistory}
                                                type="number"
                                                id="passwordinhistory"
                                                aria-describedby="horizontal-form-name-helper"
                                                name="passwordinhistory"
                                                onChange={(e, checked) => {
                                                    this.handleGeneralChange(e);
                                                }}
                                            />
                                        </div>
                                    </GridItem>
                                </Grid>
                                <Grid className="ds-margin-top" title={_("Set the password storage scheme (passwordstoragescheme).")}>
                                    <GridItem span={3} className="ds-label">
                                        {_("Password Storage Scheme")}
                                    </GridItem>
                                    <GridItem span={9}>
                                        <FormSelect
                                            id="passwordstoragescheme"
                                            value={this.state.passwordstoragescheme}
                                            onChange={(event, value) => {
                                                this.handleGeneralChange(event);
                                            }}
                                            aria-label="FormSelect Input"
                                        >
                                            {this.props.pwdStorageSchemes.map((option, index) => (
                                                <FormSelectOption
                                                    key={index}
                                                    value={option}
                                                    label={option}
                                                />
                                            ))}
                                        </FormSelect>
                                    </GridItem>
                                </Grid>
                                {isPBKDF2Scheme(this.state.passwordstoragescheme) && (
                                    <Grid title={_("Set the number of iterations to the password storage scheme plugin entry (nsslapd-pwdPBKDF2NumIterations).")}>
                                        <GridItem className="ds-label" span={3}>
                                            {_("PBKDF2 Iterations")}
                                        </GridItem>
                                        <GridItem span={9}>
                                            <TextInput
                                                value={this.state[password_storage_attrs[0]] || ''}
                                                type="number"
                                                id={password_storage_attrs[0]}
                                                aria-describedby="horizontal-form-name-helper"
                                                name={password_storage_attrs[0]}
                                                onChange={(e, checked) => {
                                                    this.handlePasswordStorageChange(e);
                                                }}
                                            />
                                        </GridItem>
                                    </Grid>
                                )}
                                <Grid
                                    title={_("Indicates the number of seconds that must pass before a user can change their password again. (passwordMinAge).")}
                                >
                                    <GridItem className="ds-label" span={3}>
                                        {_("Password Minimum Age")}
                                    </GridItem>
                                    <GridItem span={9}>
                                        <TextInput
                                            value={this.state.passwordminage}
                                            type="number"
                                            id="passwordminage"
                                            aria-describedby="horizontal-form-name-helper"
                                            name="passwordminage"
                                            onChange={(e, checked) => {
                                                this.handleGeneralChange(e);
                                            }}
                                        />
                                    </GridItem>
                                </Grid>
                                <Grid
                                    title={_("The DN for a password administrator or administrator group (passwordAdminDN).")}
                                >
                                    <GridItem className="ds-label" span={3}>
                                        {_("Password Administrator")}
                                    </GridItem>
                                    <GridItem span={9}>
                                        <TextInput
                                            value={this.state.passwordadmindn}
                                            type="text"
                                            id="passwordadmindn"
                                            aria-describedby="horizontal-form-name-helper"
                                            name="passwordadmindn"
                                            onChange={(e, checked) => {
                                                this.handleGeneralChange(e);
                                            }}
                                        />
                                    </GridItem>
                                </Grid>
                                <Grid
                                    title={_("Disable updating password state attributes like passwordExpirationtime, passwordHistory, etc, when setting a user's password as a Password Administrator (passwordAdminSkipInfoUpdate).")}
                                >
                                    <GridItem offset={3} span={9}>
                                        <Checkbox
                                            id="passwordadminskipinfoupdate"
                                            isChecked={this.state.passwordadminskipinfoupdate}
                                            onChange={(e, checked) => {
                                                this.handleGeneralChange(e);
                                            }}
                                            label={_("Do not update target entry's password state attributes")}
                                        />
                                    </GridItem>
                                </Grid>
                            </Form>
                            <Button
                                isDisabled={this.state.saveGeneralDisabled && this.state.savePasswordStorageDisabled || this.state.saving}
                                variant="primary"
                                className="ds-margin-top-xlg ds-margin-left-sm"
                                onClick={this.handleSaveGeneral}
                                isLoading={this.state.saving}
                                spinnerAriaValueText={this.state.saving ? _("Saving") : undefined}
                                {...extraPrimaryProps}
                            >
                                {saveBtnName}
                            </Button>
                        </Tab>
                        <Tab eventKey={1} title={<TabTitleText>{_("Expiration")}</TabTitleText>}>
                            <Form className="ds-margin-top-xlg ds-margin-left" isHorizontal autoComplete="off">
                                <Grid title={_("Enable a password expiration policy (passwordExp).")}>
                                    <GridItem span={12}>
                                        <Checkbox
                                            id="passwordexp"
                                            isChecked={this.state.passwordexp}
                                            onChange={(e, checked) => {
                                                this.handleExpChange(e);
                                            }}
                                            label={_("Enforce Password Expiration")}
                                        />
                                    </GridItem>
                                </Grid>
                                {pwExpirationRows}
                            </Form>
                            <Button
                                isDisabled={this.state.saveExpDisabled || this.state.saving}
                                variant="primary"
                                className="ds-margin-top-xlg ds-margin-left"
                                onClick={this.handleSaveExp}
                                isLoading={this.state.saving}
                                spinnerAriaValueText={this.state.saving ? _("Saving") : undefined}
                                {...extraPrimaryProps}
                            >
                                {saveBtnName}
                            </Button>
                        </Tab>
                        <Tab eventKey={2} title={<TabTitleText>{_("Account Lockout")}</TabTitleText>}>
                            <Form className="ds-margin-top-xlg ds-margin-left" isHorizontal autoComplete="off">
                                <Grid title={_("Enable account lockout (passwordLockout).")}>
                                    <GridItem span={12}>
                                        <Checkbox
                                            id="passwordlockout"
                                            isChecked={this.state.passwordlockout}
                                            onChange={(e, checked) => {
                                                this.handleLockoutChange(e);
                                            }}
                                            label={_("Enable Account Lockout")}
                                        />
                                    </GridItem>
                                </Grid>
                                {pwLockoutRows}
                            </Form>
                            <Button
                                isDisabled={this.state.saveLockoutDisabled || this.state.saving}
                                variant="primary"
                                className="ds-margin-top-xlg ds-margin-left"
                                onClick={this.handleSaveLockout}
                                isLoading={this.state.saving}
                                spinnerAriaValueText={this.state.saving ? _("Saving") : undefined}
                                {...extraPrimaryProps}
                            >
                                {saveBtnName}
                            </Button>
                        </Tab>
                        <Tab eventKey={3} title={<TabTitleText>{_("Syntax Checking")}</TabTitleText>}>
                            <Form className="ds-margin-top-xlg ds-margin-left" isHorizontal autoComplete="off">
                                <Grid title={_("Enable password syntax checking (passwordCheckSyntax).")}>
                                    <GridItem span={12}>
                                        <Checkbox
                                            id="passwordchecksyntax"
                                            isChecked={this.state.passwordchecksyntax}
                                            onChange={(e, checked) => {
                                                this.handleSyntaxChange(e);
                                            }}
                                            label={_("Enable Password Syntax Checking")}
                                        />
                                    </GridItem>
                                </Grid>
                                {pwSyntaxRows}
                            </Form>
                            <Button
                                isDisabled={this.state.saveSyntaxDisabled || this.state.saving}
                                variant="primary"
                                className="ds-margin-top-xlg ds-margin-left"
                                onClick={this.handleSaveSyntax}
                                isLoading={this.state.saving}
                                spinnerAriaValueText={this.state.saving ? _("Saving") : undefined}
                                {...extraPrimaryProps}
                            >
                                {saveBtnName}
                            </Button>
                        </Tab>
                        <Tab eventKey={4} title={<TabTitleText>{_("Temporary Password Rules")}</TabTitleText>}>
                            <Form className="ds-margin-top ds-margin-left" isHorizontal autoComplete="off">
                                {this.state.passwordmustchange === false && (
                                    <FormAlert className="ds-margin-top">
                                        <Alert
                                        variant="info"
                                        title={_("\"User Must Change Password After Reset\" must be enabled in General Settings to activate TPR.")}
                                        aria-live="polite"
                                        isInline
                                        />
                                    </FormAlert>
                                )}
                                <Grid
                                    title={_("Number of times the temporary password can be used to authenticate (passwordTPRMaxUse).")}
                                >
                                    <GridItem className="ds-label" span={3}>
                                        {_("Password Max Use")}
                                    </GridItem>
                                    <GridItem span={9}>
                                        <TextInput
                                            value={this.state.passwordtprmaxuse}
                                            type="number"
                                            id="passwordtprmaxuse"
                                            aria-describedby="horizontal-form-name-helper"
                                            name="passwordtprmaxuse"
                                            isDisabled={!this.state.passwordmustchange}
                                            onChange={(e, checked) => {
                                                this.handleTPRChange(e);
                                            }}
                                        />
                                    </GridItem>
                                </Grid>
                            </Form>
                            <Form className="ds-margin-top ds-margin-left" isHorizontal autoComplete="off">
                                <Grid
                                    title={_("Number of seconds before the temporary password expires (passwordTPRDelayExpireAt).")}
                                >
                                    <GridItem className="ds-label" span={3}>
                                        {_("Password Expires In")}
                                    </GridItem>
                                    <GridItem span={9}>
                                        <TextInput
                                            value={this.state.passwordtprdelayexpireat}
                                            type="number"
                                            id="passwordtprdelayexpireat"
                                            aria-describedby="horizontal-form-name-helper"
                                            name="passwordtprdelayexpireat"
                                            isDisabled={!this.state.passwordmustchange}
                                            onChange={(e, checked) => {
                                                this.handleTPRChange(e);
                                            }}
                                        />
                                    </GridItem>
                                </Grid>
                            </Form>
                            <Form className="ds-margin-top ds-margin-left" isHorizontal autoComplete="off">
                                <Grid
                                    title={_("Number of seconds after which temporary password starts to be valid for authentication (passwordTPRDelayValidFrom).")}
                                >
                                    <GridItem className="ds-label" span={3}>
                                        {_("Password Valid From")}
                                    </GridItem>
                                    <GridItem span={9}>
                                        <TextInput
                                            value={this.state.passwordtprdelayvalidfrom}
                                            type="number"
                                            id="passwordtprdelayvalidfrom"
                                            aria-describedby="horizontal-form-name-helper"
                                            name="passwordtprdelayvalidfrom"
                                            isDisabled={!this.state.passwordmustchange}
                                            onChange={(e, checked) => {
                                                this.handleTPRChange(e);
                                            }}
                                        />
                                    </GridItem>
                                </Grid>
                            </Form>
                            <Button
                                isDisabled={this.state.saveTPRDisabled || this.state.saving}
                                variant="primary"
                                className="ds-margin-top-xlg ds-margin-left"
                                onClick={this.handleSaveTPR}
                                isLoading={this.state.saving}
                                spinnerAriaValueText={this.state.saving ? _("Saving") : undefined}
                                {...extraPrimaryProps}
                            >
                                {saveBtnName}
                            </Button>
                        </Tab>
                    </Tabs>
                </div>
            );
        }

        return (
            <div className={this.state.saving ? "ds-disabled" : ""}>
                <Grid>
                    <GridItem span={12}>
                        <TextContent>
                            <Text component={TextVariants.h3}>
                                {_("Global Password Policy")}
                                <Button
                                    variant="plain"
                                    aria-label={_("Refresh global password policy settings")}
                                    onClick={this.handleLoadGlobal}
                                    className="ds-left-margin"
                                >
                                    <SyncAltIcon />
                                </Button>
                            </Text>
                        </TextContent>
                    </GridItem>
                </Grid>
                {pwp_element}
            </div>
        );
    }
}

GlobalPwPolicy.propTypes = {
    attrs: PropTypes.array,
    pwdStorageSchemes: PropTypes.array,
};

GlobalPwPolicy.defaultProps = {
    attrs: [],
    pwdStorageSchemes: []
};
