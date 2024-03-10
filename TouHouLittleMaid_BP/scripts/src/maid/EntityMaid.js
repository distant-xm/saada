import { Entity, EntityTypes, world,Vector,Dimension,system, EntityHealthComponent, Container, ItemStack, WorldInitializeAfterEvent, Block, Player } from "@minecraft/server";
import { MaidBackpack } from "./MaidBackpack";
import * as Tool from "../libs/scarletToolKit"
import { config } from "../controller/Config"
import { StrMaid } from "./StrMaid";
import { emote } from "../../data/emote";
import { MaidSkin } from "./MaidSkin";

export class EntityMaid{
    /**
     * 格式化输出 rawtext
     * @param {Entity} maid
     * @returns {object}
     */
    static formatOutput(maid){
        let rawtext = []
        // 标题
        rawtext.push({"translate": "message.tlm.admin.maid_info"});
        rawtext.push({"text":"\n"});
        // 女仆名称
        rawtext.push({"translate": "message.tlm.admin.maid.name"});
        rawtext.push({"text": `${maid.nameTag}\n`});
        // 主人名称
        rawtext.push({"translate": "message.tlm.admin.maid.owner.name"});
        rawtext.push({"text": `${this.Owner.getName(maid)}\n`});
        // 主人ID
        rawtext.push({"translate": "message.tlm.admin.maid.owner.id"});
        rawtext.push({"text": `${this.Owner.getID(maid)}\n`});
        // 等级
        rawtext.push({"translate": "message.tlm.admin.maid.level"});
        rawtext.push({"text": `${this.Level.get(maid)}\n`});
        // 杀敌数
        rawtext.push({"translate": "message.tlm.admin.maid.kill"});
        rawtext.push({"text": `${this.Kill.get(maid)}\n`});
        // 生命值
        rawtext.push({"translate": "message.tlm.admin.maid.health"});
        rawtext.push({"text": `${this.Health.get(maid)}/${this.Health.getMax(maid)}\n`});
        // 工作模式
        rawtext.push({"translate": "message.tlm.admin.maid.work"});
        rawtext.push({"text": `${EntityMaid.Work.getName(this.Work.get(maid))}\n`});
        // 隐藏背包
        rawtext.push({"translate": "message.tlm.admin.maid.backpack"});
        rawtext.push({"text": `${this.Backpack.getInvisible(maid)}\n`});
        // 拾物模式
        rawtext.push({"translate": "message.tlm.admin.maid.pick"});
        rawtext.push({"text": `${this.Pick.get(maid)}\n`});

        return rawtext;
    }

    /**
     * 初始化女仆动态属性
     *  在刚生成时调用
     * @param {Entity} maid 
     */
    static initDynamicProperties(maid){
        if(maid.getDynamicProperty("heal_step") === undefined) maid.setDynamicProperty("heal_step", 0);
        if(maid.getDynamicProperty("home")      === undefined) maid.setDynamicProperty("home"     , {x:0, y:0, z:0});
        if(maid.getDynamicProperty("home_dim")  === undefined) maid.setDynamicProperty("home_dim" , 0);
        if(maid.getDynamicProperty("temp_pick") === undefined) maid.setDynamicProperty("temp_pick", false);
        if(maid.getDynamicProperty("level")     === undefined) maid.setDynamicProperty("level"    , 1);
        if(maid.getDynamicProperty("kill")      === undefined) maid.setDynamicProperty("kill"     , 0);
        if(maid.getDynamicProperty("pick")      === undefined) maid.setDynamicProperty("pick"     , false);
    }
    // 等级
    static Level = {
        max:2,
        properties:[
            {// lv.1
                "danmaku": 15,    // 弹幕伤害
                "heal"   : [3, 6] // 单次回血量（3秒一次）
            },
            {// lv.2
                "danmaku": 24,    // 弹幕伤害
                "heal"   : [5, 8] // 单次回血量（3秒一次）
            },
            {// lv.3
                "danmaku": 24,    // 弹幕伤害
                "heal"   : [5, 8] // 单次回血量（3秒一次）
            }
        ],
        str:[
            "§l§aLv.1§r",
            "§l§bLv.2§r",
            "§l§cLv.3§r",
            "§l§dLv.4§r",
            "§l§eLv.5§r",
            "§l§bL§cv§d.§e6§r",
        ],
        /**
         * 获取等级
         * @param {Entity} maid
         * @returns {number}
         */
        get(maid){
            return maid.getDynamicProperty("level");
        },
        /**
         * 获取等级字符串
         * @param {Entity} maid
         * @returns {number}
         */
        getStr(maid){
            return this.str[this.get(maid)-1];
        },
        /**
         * 设置等级
         * @param {Entity} maid
         * @param {number} level
         */
        set(maid, level){
            let oldLevel = this.get(maid);
            if(oldLevel !== undefined){
                maid.triggerEvent(`api:lv_${oldLevel}_basic_quit`);
            }
            if(maid.getComponent("minecraft:is_tamed") !== undefined){
                maid.triggerEvent(`api:lv_${oldLevel}_tame_quit`);
            }

            system.runTimeout(()=>{
                this.eventBasic(maid, level);
                if(maid.getComponent("minecraft:is_tamed") !== undefined){
                    this.eventTamed(maid, level);
                }
            },1)
            
            maid.setDynamicProperty("level", level);
        },
        /**
         * 触发基础事件
         * @param {Entity} maid
         */
        eventBasic(maid){
            maid.triggerEvent(`api:lv_${this.get(maid)}_basic`);
        },
        /**
         * 触发驯服事件
         * @param {Entity} maid
         */
        eventTamed(maid){
            maid.triggerEvent(`api:lv_${this.get(maid)}_tame`);
        },
        /**
         * 属性值获取
         * @param {Entity} maid 
         * @param {string} key danmaku | heal
         * @returns {number | Array}
         */
        getProperty(maid, key){
            return this.properties[this.get(maid)-1][key];
        }
    }
    // 主人
    static Owner = {
        /**
         * 是否有主人
         * @returns {boolean}
         */
        has(maid){
            if(this.getID(maid) === undefined && this.getName(maid) == undefined){
                return false;
            }
            return true;
        },
        /**
         * 获取主人ID
         * @param {Entity} maid
         * @returns {string|undefined}
         */
        getID(maid){
            return Tool.getTagData(maid, "thlmo:");
        },
        /**
         * 设置主人ID
         * @param {Entity} maid 
         * @param {string} id 
         */
        setID(maid, id){
            Tool.delTagData(maid, "thlmo:");
            Tool.setTagData(maid, "thlmo:", id);
        },
        /**
         * 获取主人名称
         * @param {Entity} maid
         * @returns {string|undefined}
         */
        getName(maid){
            return Tool.getTagData(maid, "thlmn:");
        },
        /**
         * 设置主人名称
         * @param {Entity} maid 
         * @param {string} name 
         */
        setName(maid, name){
            Tool.delTagData(maid, "thlmn:");
            Tool.setTagData(maid, "thlmn:", name);
        },
        /**
         * 获取主人实体
         * @param {Entity} maid
         * @returns {Entity|undefined}
         */
        get(maid){
            let id = this.getID(maid);
            if(id!==undefined){
                return world.getEntity(id);
            }
            let name = this.getName(maid);
            if(name!==undefined){
                let players = world.getPlayers({"name": name});
                if(players.length()!==0){
                    return players[0];
                }
            }
            return undefined;
        },
        /**
         * 设置主人实体
         * @param {Entity} maid
         * @param {Player} player
         */
        set(maid, player){
            this.setID(maid, player.id);
            this.setName(maid, player.name);
        }
    }
    // 生命值
    static Health = {
        /**
         * 获取生命值属性
         * @param {Entity} maid
         * @returns {EntityHealthComponent}
         */
        getComponent(maid){
            return maid.getComponent("health");
        },
        /**
         * 获取最大生命值
         * @param {Entity} maid
         * @returns {Number} Max value
         */
        get(maid){
            return this.getComponent(maid).currentValue;
        },
        /**
         * 获取最大生命值
         * @param {Entity} maid
         * @returns {Number} Max value
         */
        getMax(maid){
            return this.getComponent(maid).defaultValue;
        },

        /**
         * 设置生命值
         * @param {Entity} maid
         * @param {number} amount 
         */
        set(maid, amount){
            return this.getComponent(maid).setCurrentValue(amount);
        },
        /**
         * TODO: 设置最大生命值 *未实现
         * @param {Entity} maid
         * @param {number} amount 
         */
        setMax(maid, amount){
            
        },
        // 特殊字符的起始位置
        strOffset: 0xE600,
        /**
         * 将健康值（整数）转换为文本
         * @param {Int} health
         */
        toStr(health){
            let result = "";
            let stack = Math.floor(health / 20);
            let value = health % 20;
            if(value===0) value=20;
            for(let i = 10; i > 0;){
                if(value >= 2){
                    value -= 2;
                    result += this.fullStr();
                }
                else if(value === 1){
                    value -= 1;
                    result += this.halfStr();
                }
                else{
                    result += this.emptyStr();
                }
                i--;
            }
            return result
        },
        emptyStr(){ return String.fromCodePoint(this.strOffset + 0x03); },
        halfStr(){ return String.fromCodePoint(this.strOffset + 0x04); },
        fullStr(){ return String.fromCodePoint(this.strOffset + 0x05); }
    }
    static Kill = {
        /**
         * 获取杀敌数
         * @param {Entity} maid 
         * @returns {number}
         */
        get(maid){
            return maid.getDynamicProperty("kill");
        },
        /**
         * 设置杀敌数
         * @param {Entity} maid 
         * @param {number} amount
         */
        set(maid, amount){
            maid.setDynamicProperty("kill", amount);
        }
    }
    // 皮肤
    static Skin = {
        /**
         * 设置模型包编号
         * @param {Entity} maid 
         * @param {number} skinpack
         * @returns {number}
         */
        setPack(maid, skinpack){
            maid.setProperty("thlm:skin_pack", skinpack);
        },
        /**
         * 设置模型编号 从 0 开始
         * @param {Entity} maid
         *  @param {number} index
         */
        setIndex(maid, index){
            maid.triggerEvent(`skin:${index}`);
        },
        /**
         * 获取模型包编号
         * @param {Entity} maid 
         * @returns {number}
         */
        getPack(maid){
            return maid.getProperty("thlm:skin_pack");
        },
        /**
         * 获取模型编号
         * @param {Entity} maid 
         * @returns {number}
         */
        getIndex(maid){
            return maid.getComponent("minecraft:variant").value;
        },
        /**
         * 随机设置一个皮肤
         * @param {Entity} maid 
         */
        setRandom(maid){
            let target = MaidSkin.getRandom();
            this.setPack(maid, target.pack);
            this.setIndex(maid, target.seq);
        }
    }
    // 拾物模式
    static Pick = {
        /**
         * 设置模式
         * @param {Entity} maid 
         * @param {boolean} value
         */
        set(maid, value){
            maid.triggerEvent(value?"api:mode_pick":"api:mode_quit_pick");
            maid.setDynamicProperty("pick", value);
        },
        switchMode(maid){
            this.set(maid, !this.get(maid));
        },
        /**
         * 获取模式
         * @param {Entity} maid 
         * @returns {boolean}
         */
        get(maid){
            return maid.getDynamicProperty("pick");
        },
        getImg(is_open){
            return is_open?"textures/gui/pick_activate.png":"textures/gui/pick_deactivate.png"
        },
        getLang(is_open){
            return is_open?"gui.touhou_little_maid:button.pick.true.name":"gui.touhou_little_maid:button.pick.false.name"
        }
    }
    // 骑乘模式
    static Ride = {
        switchMode(maid){
            
        },
        getImg(is_open){
            return is_open?"textures/gui/ride_activate.png":"textures/gui/ride_deactivate.png"
        },
        getLang(is_open){
            return is_open?"gui.touhou_little_maid:button.ride.true.name":"gui.touhou_little_maid:button.ride.false.name"
        }
    }
    // 工作模式
    static Work = {
        AMOUNT         : 4,  // 总数（包含空闲）
        
        idle           : 0,  // 空闲
        attack         : 1,  // 攻击
        danmaku_attack : 2,  // 弹幕攻击
        farm           : 3,  // 农场


        sugar_cane     : 4,  // 甘蔗
        melon          : 5,  // 瓜类
        cocoa          : 6,  // 可可
        grass          : 7,  // 花草
        snow           : 8,  // 清雪

        feed           : 9,  // 喂食
        
        shears         : 10, // 剪刀
        milk           : 11, // 牛奶
        torch          : 12, // 火把
        
        feed_animal    : 13, // 繁殖动物
        extinguishing  : 14, // 灭火
        
        ranged_attack  : 15,
        NAME_LIST:[
            "idle",
            "attack",
            "danmaku_attack",
            "farm",
            "sugar_cane",
            "melon",
            "cocoa",
            "grass",      
            "snow",
            "feed",
            "shears",
            "milk",
            "torch",
            "feed_animal",
            "extinguishing",
            "ranged_attack"
        ],
        // 切换到模式时的音效(现在已经转移到行为包内播放)
        SOUND_LIS:[
            undefined,
            "mob.thlmm.maid.attack",
            "mob.thlmm.maid.attack",
            undefined,


            undefined,
            undefined,
            undefined,          
            undefined,      
            undefined,
            "mob.thlmm.maid.feed",
            undefined,
            undefined,
            undefined,
            "mob.thlmm.maid.feed",
            undefined
        ],
        // UI 图标
        IMG_LIST:[
            "textures/items/feather.png",
            "textures/items/diamond_sword.png",
            "textures/items/hakurei_gohei.png",
            "textures/items/iron_hoe.png",


            "textures/items/reeds.png",
            "textures/items/melon.png",
            "textures/items/dye_powder_brown.png",
            "textures/blocks/tallgrass.png",
            "textures/items/snowball.png",
            "textures/items/beef_cooked.png",
            "textures/items/shears.png",
            "textures/items/bucket_milk.png",
            "textures/items/torch_on.png",
            "textures/items/wheat.png",
            "textures/items/extinguisher.png",

            "textures/items/bow_standby.png"
        ],
    
        /**
         * 获取工作模式
         * @param {Entity} maid 
         * @returns {number}
         */
        get(maid){
            return maid.getProperty("thlm:work");
        },
        /**
         * 设置工作模式
         * @param {Entity} maid 
         * @param {number} type
         */
        set(maid, type){
            maid.triggerEvent(this.getEventName(maid, this.get(maid), true));
            system.runTimeout(()=>{
                maid.triggerEvent(this.getEventName(maid, type, false));
            },1); // 有些工作模式存在相同的组件，避免删除
        },
        /**
         * 获取名称
         * @param {number} type
         * @returns {string}
         */
        getName(type){
            return this.NAME_LIST[type];
        },
        /**
         * 获取事件名称
         */
        getEventName(maid, type, quit){
            // 拼接基础字符串
            let result = "api:mode_";
            if(quit) result += "quit_";
            result += this.getName(type);
            
            // 受等级影响的类型
            if(type === this.farm || type === this.attack){
                result += `_lv${EntityMaid.Level.get(maid)}`;
            }
            return result;
        },
        /**
         * 获取语言文件字符串
         * @param {number} type
         * @returns {string}
         */
        getLang(type){
            return `task.touhou_little_maid:${this.getName(type)}.name`;
        },
        /**
         * 获取按钮材质
         * @param {number} type
         * @returns {string}
         */
        getIMG(type){
            return this.IMG_LIST[type];
        },
        /**
         * 获取声音
         * @param {*} type
         * @returns {string|undefined}
         */
        getSound(type){
            return this.SOUND_LIST[type];
        }
    }
    /// 字符化时不(全)记录的属性
    // 家 
    static Home = {
        /**
         * 获取home模式
         * @param {Entity} maid 
         */
        getMode(maid){
            return maid.getComponent("minecraft:is_baby")!==undefined;
        },
        /**
         * 切换home模式
         * @param {Entity} maid
         */
        switchMode(maid){
            if(this.getMode(maid)===true){
                // 家模式 → 跟随模式
                maid.triggerEvent("api:status_follow");
            }
            else{
                // 跟随模式 → 家模式
                this.setLocation(maid);
                maid.triggerEvent("api:status_home");
            }
        },
        getImg(is_open){
            return is_open?"textures/gui/home_activate.png":"textures/gui/home_deactivate.png"
        },
        getLang(is_open){
            return is_open?"gui.touhou_little_maid:button.home.true.name":"gui.touhou_little_maid:button.home.false.name"
        },
        /**
         * 设置家为当前位置
         * @param {Entity} maid 
         */
        setLocation(maid){
            let l = maid.location;
            maid.setDynamicProperty("home", {x: l.x, y:l.y, z:l.z}); // {x: Math.ceil(l.x), y:Math.ceil(l.y), z:Math.ceil(l.z)}
            maid.setDynamicProperty("home_dim", Tool.dim_string2int(maid.dimension.id));
            // maid.setProperty("thlm:home_x", Math.ceil(l.x));
            // maid.setProperty("thlm:home_y", Math.ceil(l.y));
            // maid.setProperty("thlm:home_z", Math.ceil(l.z));
            // maid.setProperty("thlm:home_dim", Tool.dim_string2int(maid.dimension.id));
        },
        /**
         * 获取家的位置
         * @param {Entity} maid 
         * @returns {number[]|undefined}
         */
        getLocation(maid){
            // let x = maid.getProperty("thlm:home_x");
            // let y = maid.getProperty("thlm:home_y")
            // let z = maid.getProperty("thlm:home_z");
            // let dim = maid.getProperty("thlm:home_dim");
            let location = maid.getDynamicProperty("home");
            let x = location.x;
            let y = location.y;
            let z = location.z;
            let dim = maid.getDynamicProperty("home_dim");
            if(x===0 && y===0 && z===0 && dim===0) return undefined;
            return [x, y, z, Tool.dim_int2string(maid.getDynamicProperty("home_dim"))];
        }
    }    
    // 背包 只记录是否可见
    static Backpack = {
        /**
         * 获取背包ID
         * @param {Entity} maid 
         * @returns {string|undefined}
         */
        getID(maid){
            return Tool.getTagData(maid, "thlmb:");
        },
        /**
         * 设置背包id
         * @param {Entity} maid 
         * @param {string} id 
         */
        setID(maid, id){
            Tool.delTagData(maid, "thlmb:");
            Tool.setTagData(maid, "thlmb:", id);
        },

        /**
         * 获取背包是否隐藏
         * @param {Entity} maid 
         * @returns {boolean}
         */
        getInvisible(maid){
            return maid.getProperty("thlm:backpack_invisible");
        },
        /**
         * 设置背包是否隐藏
         * @param {Entity} maid
         * @param {boolean} target
         */
        setInvisible(maid, value){
            return maid.setProperty("thlm:backpack_invisible", value);
        },

        /**
         * 获取背包实体
         * @param {Entity} maid 
         * @returns {Entity|undefined}
         */
        getEntity(maid){
            let id = this.getID(maid);
            if(id !== undefined){
                return world.getEntity(id);
            }
            return undefined;
        },
        /**
         * 获取背包内容
         * @param {Entity} maid 
         * @returns {Container|undefined}
         */
        getContainer(maid){
            let backpack = this.getEntity(maid);
            if(backpack !== undefined){
                return MaidBackpack.getContainer(backpack);
            }
            return undefined;
        },
        /**
         * 获取背包类型（大小）
         * @param {Entity} maid
         * @returns {number} 0~3 
         */
        getType(maid){
            return maid.getProperty("thlm:backpack_type");
        }
    }
    // 表情
    static Emote = {
        timeout:undefined,
        /**
         * 获取当前表情ID
         * @param {Entity} maid 
         * @returns {number}
         */
        get(maid){
            return maid.getProperty("thlm:emote");
        },
        /**
         * 设置表情ID
         * @param {Entity} maid 
         * @param {number} index 
         */
        set(maid, index){
            if(this.timeout !== undefined){
                system.clearRun(this.timeout);
                this.timeout=undefined;
            }
            let value = index;
            if(emote[index] !== undefined){
                value += 1000*emote[index][0];
                value += 1000000*emote[index][1];
                this.timeout = system.runTimeout(()=>{
                    this.set(maid, 0);
                }, emote[index][2]);
            }
            maid.setProperty("thlm:emote", value);
        },
        // 背包 起始位置1
        backpack(maid){
            this.set(maid, 1 + EntityMaid.Backpack.getType(maid));
        },
        apple(maid){ this.set(maid, 5); }, // 苹果 5
        cake (maid){ this.set(maid, 6); } // 蛋糕 6
    }
    /**
     * 将女仆背包的内容转移到实体背包
     * 若实体背包内存在物品，则将其丢弃
     * @param {Entity} maid 
     * @returns 
     */
    static dumpMaidBackpack(maid){
        let backpack = this.Backpack.getContainer(maid);
        if(backpack === undefined) return false;
        
        let maidContainer = maid.getComponent("inventory").container;
        for(let i = 0; i < maidContainer.size; i++){
            let maidItem = maidContainer.getItem(i);
            if(maidItem !== undefined){
                // 若实体背包内存在物品，则将其丢弃
                let backpackItem = backpack.getItem(i);
                if(backpackItem !== undefined){
                    maid.dimension.spawnItem(backpackItem, maid.location);
                    backpack.setItem(i);
                }
                // 将女仆背包的内容转移到实体背包
                backpack.setItem(i, maidItem);
                maidContainer.setItem(i);
            }
        }
        return true;
    }
    /**
     * 将实体背包内容转移到女仆背包
     * 若女仆背包内存在物品，则将其丢弃
     * @param {Entity} maid
     * @returns 
     */
    static dumpEntityBackpack(maid){
        let backpack = this.Backpack.getContainer(maid);
        if(backpack === undefined) return false;
        
        let maidContainer = maid.getComponent("inventory").container;
        for(let i = 0; i < maidContainer.size; i++){
            let backpackItem = backpack.getItem(i);
            if(backpackItem !== undefined){
                let maidItem = maidContainer.getItem(i);
                if(maidItem !== undefined){
                    maid.dimension.spawnItem(maidItem, maid.location);
                    maidContainer.setItem(i);
                }
                maidContainer.setItem(i, backpackItem);
                backpack.setItem(i);
            }
        }
        return true;
    }
    
    /// 字符化
    /**
     * 将女仆转为字符
     * @param {Entity} maid 
     * @returns {string}
     */
    static toStr(maid){
        let maidStr = "";
        /// 记录女仆状态 ///
        // 主人id, 可为空（野生女仆）
        let o_id = this.Owner.getID(maid);
        if(o_id !== undefined){
            maidStr = StrMaid.Owner.setID(maidStr, o_id);
        }
        // 等级
        maidStr = StrMaid.Level.set(maidStr, this.Level.get(maid));
        // 杀敌数
        maidStr = StrMaid.Kill.set(maidStr, this.Kill.get(maid));
        // 生命值
        let health = maid.getComponent("health");
        maidStr = StrMaid.Health.set(maidStr, health.currentValue, health.defaultValue);
        // 皮肤
        maidStr = StrMaid.Skin.set(maidStr, this.Skin.getPack(maid),this.Skin.getIndex(maid))
        // 工作模式
        maidStr = StrMaid.Work.set(maidStr, this.Work.get(maid));
        // maidStr = StrMaid.Work.set(maidStr, this.Work.get(maid));
        // 拾物模式
        maidStr = StrMaid.Pick.set(maidStr, this.Pick.get(maid));
        // 背包是否隐藏
        maidStr = StrMaid.backpackInvisibility.set(maidStr, this.Backpack.getInvisible(maid));

        // 字符类数据最后设置
        if(o_id !== undefined){
            // 主人名称
            maidStr = StrMaid.Str.setOwnerName(maidStr, this.Owner.getName(maid));
            // 女仆名称
            if(maid.nameTag!=="") maidStr = StrMaid.Str.setMaidName(maidStr, maid.nameTag);
        }
        /**
         * 打包背包
         * 正常情况不会为空，以防万一假设可为空
         * b: backpack,背包大小
         * bi: backpack id, 临时背包的生物id
         */ 
        EntityMaid.dumpMaidBackpack(maid);// 转储 女仆→背包实体
        let backpack_id = this.Backpack.getID(maid);
        if(backpack_id !== undefined){
            let backpack = world.getEntity(backpack_id);
            if(backpack !== undefined){
                if(MaidBackpack.getType(backpack) === MaidBackpack.default){
                    // 爆出物品
                    MaidBackpack.dump(backpack, backpack.location);
                }
                else{
                    MaidBackpack.setInvisible(backpack, false);
                    backpack.triggerEvent("api:grave");
                }
            }
        }
        return maidStr;
        
    }
    /**
     * 将字符转为女仆  由照片、魂符放出的女仆不会回满血
     * @param {string} maidStr
     * @param {Dimension} dimension
     * @param {Vector} location 
     * @param {boolean} [set_health=false]
     * @returns {Entity|undefined} maid
     */
    static fromStr(maidStr, dimension, location, set_health=false){
        /// 生成女仆 ///
        var maid = dimension.spawnEntity("thlmm:maid", location);
        /// 设置状态 ///
        // 等级
        this.Level.set(maid, StrMaid.Level.get(maidStr));
        // 杀敌数
        this.Kill.set(maid, StrMaid.Kill.get(maidStr));
        // 主人ID  可为空
        let ownerID = StrMaid.Owner.getId(maidStr);
        if(ownerID !== undefined) this.Owner.setID(maid, ownerID);
        // 生命值  延时设置，等待 level 调血
        if(set_health){
            system.runTimeout(()=>{
                this.Health.set(maid, StrMaid.Health.get(maidStr).current);
            }, 2);
        }
        // 皮肤
        let skin = StrMaid.Skin.get(maidStr);
        this.Skin.setPack(maid, skin.pack);
        this.Skin.setIndex(maid, skin.index);
        // 工作模式 不再设置
        // this.Work.set(maid, StrMaid.Work.get(maidStr));

        // 拾物模式
        this.Pick.set(maid, StrMaid.Pick.get(maidStr));
        // 背包是否隐藏
        this.Backpack.setInvisible(maid, StrMaid.backpackInvisibility.get(maidStr));

        // 字符数据
        // 女仆名称
        let maidName = StrMaid.Str.getMaidName(maidStr);
        if(maidName!==undefined){ maid.nameTag = maidName }
        // 主人名称
        let ownerName = StrMaid.Str.getOwnerName(maidStr);
        if(ownerName!==undefined){ this.Owner.setName(maid, ownerName)};

        return maid;

        /**
         * 获取背包（弃用）
         * l: location, 位置
         * b: backpack,背包大小
         * bi: backpack id, 临时背包的生物id
         */
        if(infos["b"] !== undefined){
            // 生成新包
            var new_backpack = MaidBackpack.create(maid, infos["b"], dimension, location);
            // 隐藏包（因为无法正常渲染）
            MaidBackpack.setInvisible(new_backpack, true);

            // 寻找旧包(保存到常加载区域的方案)
            let old_id = infos["bi"];
            if(old_id !== undefined){
                system.runTimeout(()=>{
                    let old_backpack = world.getEntity(old_id);
                    if(old_backpack !== undefined){
                        MaidBackpack.copy(old_backpack, new_backpack);
                        old_backpack.triggerEvent("despawn");
                    }
                }, 1);// 延迟是为了背包初始化
            }
           

            // 背上包
            system.runTimeout(()=>{
                maid.runCommand("ride @e[c=1,type=touhou_little_maid:maid_backpack] start_riding @s");
            }, 1);
        }
    }
    /**
     * 将物品的lore数组转为女仆  由照片、魂符放出的女仆不会回满血
     * @param {string[]} lores
     * @param {Dimension} dimension
     * @param {Vector} location 
     * @param {boolean} [set_health=false]
     * @param {*} player 
     */
    static fromLore(lores, dimension, location, set_health=false, player=undefined){

    }
    /**
     * 将女仆转为物品lore
     * 会自动清除背包
     * @param {Entity} maid
     * @returns {string} lore
     */
    static toLore(maid){
        let strPure = this.toStr(maid);
        return this.str2Lore(strPure);
    }
    /**
     * 将纯净字符串转为物品lore
     * @param {string} strPure 
     * @returns {string[]}
     */
    static str2Lore(strPure){
        let strLore = Tool.pureStr2Lore(strPure);
        let lore =[];
        while(true){
            if(strLore.length > 50){
                lore.push(strLore.slice(0, 50));
                strLore = strLore.slice(50);
            }
            else{
                lore.push(strLore);
                break;
            }
        }
        return lore;
    }

    /// 其它
    /**
     * 播放声音
     * @param {Entity} maid 
     * @param {string} name 
     */
    static playSound(maid, name){
        maid.dimension.runCommand(`playsound ${name} @a ${maid.location.x} ${maid.location.y} ${maid.location.z}`);
    }
    /**
     * 生成一个随机女仆
     * @param {Dimension} dimension 
     * @param {Vector} location 
     * @returns {Entity} maid
     */
    static spawnRandomMaid(dimension, location){
        // 现在只是生成默认女仆
        return dimension.spawnEntity("thlmm:maid", location);
    }
    /**
     * 判断一个方块是否安全（用于放置女仆）
     * @param {Block|undefined} block 
     * @returns {boolean}
     */
    static isSafeBlock(block){
        if(block===undefined || block.isAir) return true;
        return false;
    }
}