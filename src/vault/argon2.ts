// 单独一个文件按名字导出：动态 import("hash-wasm") 会把它所有的算法都打进包里，这样只留 Argon2id
export { argon2id } from "hash-wasm";
